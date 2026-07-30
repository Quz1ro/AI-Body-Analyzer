"""
AI Service — LLM integration for chat assistant and recommendation generation.
"""

import json
import base64
import logging
import asyncio
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# System prompt for the AI assistant
SYSTEM_PROMPT = """Ти — AI-тренер у застосунку AI Body Analyzer. Твоя роль:

1. Аналізувати результати pose estimation (ключові точки, пропорції, симетрію, поставу).
2. Надавати рекомендації щодо тренувань та харчування загального характеру.
3. Пояснювати метрики простою зрозумілою мовою.
4. Давати поради щодо техніки виконання вправ.

ВАЖЛИВІ ОБМЕЖЕННЯ:
- НЕ давай медичних діагнозів.
- Завжди рекомендуй звернутися до лікаря при серйозних відхиленнях постави.
- Всі рекомендації мають інформаційний характер і не замінюють консультацію лікаря чи сертифікованого тренера.
- Відповідай українською мовою, якщо користувач не вказав іншу.
- Будь дружнім, підтримуючим та мотивуючим.
"""


async def generate_chat_reply(
    user_message: str,
    user_name: str,
    analysis_context: dict | None = None,
    chat_history: list[tuple[str, str]] | None = None,
) -> str:
    """Generate AI assistant reply using LLM API."""

    # Build context
    context_parts = [f"Ім'я користувача: {user_name}"]
    if analysis_context:
        context_parts.append(f"Останній аналіз тіла:\n{json.dumps(analysis_context, ensure_ascii=False, indent=2)}")

    context_str = "\n\n".join(context_parts)

    # Build messages for LLM
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\n\nКонтекст користувача:\n{context_str}"},
    ]

    # Add chat history
    if chat_history:
        for role, content in chat_history[-8:]:  # Last 8 messages for context window
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    # Call LLM
    if settings.LLM_PROVIDER == "gemini" and settings.LLM_API_KEY:
        return await _call_gemini(messages)
    elif settings.LLM_PROVIDER == "openai" and settings.LLM_API_KEY:
        return await _call_openai(messages)
    else:
        # Fallback: rule-based response when no API key
        return _fallback_response(user_message, analysis_context)


async def stream_chat_reply(
    user_message: str,
    user_name: str,
    analysis_context: dict | None = None,
    chat_history: list[tuple[str, str]] | None = None,
):
    """Stream AI assistant reply using LLM API."""
    # Build context
    context_parts = [f"Ім'я користувача: {user_name}"]
    if analysis_context:
        context_parts.append(f"Останній аналіз тіла:\n{json.dumps(analysis_context, ensure_ascii=False, indent=2)}")

    context_str = "\n\n".join(context_parts)

    # Build messages for LLM
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\n\nКонтекст користувача:\n{context_str}"},
    ]

    # Add chat history
    if chat_history:
        for role, content in chat_history[-8:]:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    # Call LLM streaming
    if settings.LLM_PROVIDER == "gemini" and settings.LLM_API_KEY:
        async for chunk in _stream_gemini(messages):
            yield chunk
    elif settings.LLM_PROVIDER == "openai" and settings.LLM_API_KEY:
        async for chunk in _stream_openai(messages):
            yield chunk
    else:
        # Fallback: stream in small words
        fallback_text = _fallback_response(user_message, analysis_context)
        words = fallback_text.split(" ")
        for i in range(0, len(words), 3):
            yield " ".join(words[i:i+3]) + " "
            await asyncio.sleep(0.08)


async def _stream_openai(messages: list[dict]):
    """Stream OpenAI-compatible API."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.LLM_API_KEY)
    try:
        response = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
            stream=True,
        )
        async for chunk in response:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        logger.error(f"OpenAI streaming failed: {e}")
        yield f"Помилка при виклику OpenAI: {str(e)}"


async def _stream_gemini(messages: list[dict]):
    """Stream Google Gemini API using Server-Sent Events (SSE)."""
    contents = []
    system_prompt = ""
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            system_prompt = content
        else:
            gemini_role = "user" if role == "user" else "model"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })
            
    payload = {
        "contents": contents
    }
    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }
        
    models_to_try = [settings.LLM_MODEL]
    for alt_model in ["gemini-3.1-flash-lite"]:
        if alt_model not in models_to_try:
            models_to_try.append(alt_model)
            
    api_keys = settings.llm_api_keys or [settings.LLM_API_KEY]
    
    last_error = None
    for api_key in api_keys:
        if not api_key:
            continue
        for model in models_to_try:
            # alt=sse enables Server-Sent Events for true real-time streaming
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}&alt=sse"
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code == 200:
                            buffer = ""
                            async for chunk in response.aiter_text():
                                buffer += chunk
                                # Process complete SSE lines
                                while "\n" in buffer:
                                    line, buffer = buffer.split("\n", 1)
                                    line = line.strip()
                                    if line.startswith("data: "):
                                        json_str = line[6:]  # Remove "data: " prefix
                                        try:
                                            data = json.loads(json_str)
                                            candidates = data.get("candidates", [])
                                            if candidates:
                                                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                                if text:
                                                    yield text
                                        except json.JSONDecodeError as parse_err:
                                            logger.debug(f"Skipping unparseable SSE chunk: {parse_err}")
                            return  # Success
                        else:
                            err_content = await response.aread()
                            last_error = f"Status {response.status_code}: {err_content.decode('utf-8', errors='ignore')}"
            except Exception as e:
                logger.error(f"Gemini streaming failed for model {model}: {e}")
                last_error = str(e)
                
    yield f"Помилка при виклику Gemini API: {last_error}"


async def _call_openai(messages: list[dict]) -> str:
    """Call OpenAI-compatible API."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.LLM_API_KEY)
    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=messages,
        max_tokens=1000,
        temperature=0.7,
    )
    return response.choices[0].message.content


async def _call_gemini(messages: list[dict]) -> str:
    """Call Google Gemini API generateContent endpoint with multiple API keys and automatic model fallback."""
    contents = []
    system_prompt = ""
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            system_prompt = content
        else:
            gemini_role = "user" if role == "user" else "model"
            contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })
            
    payload = {
        "contents": contents
    }
    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }
        
    # Order of models to try
    models_to_try = [settings.LLM_MODEL]
    for alt_model in ["gemini-3.1-flash-lite"]:
        if alt_model not in models_to_try:
            models_to_try.append(alt_model)
            
    # Get all API keys
    api_keys = settings.llm_api_keys or [settings.LLM_API_KEY]
    
    last_error = None
    for api_key in api_keys:
        if not api_key:
            continue
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        result_json = response.json()
                        candidates = result_json.get("candidates", [])
                        if candidates:
                            logger.info(f"Successfully generated chat response using model: {model}")
                            return candidates[0]["content"]["parts"][0]["text"]
                    else:
                        logger.warning(f"Chat model {model} failed with status {response.status_code} for key ending in ...{api_key[-6:] if len(api_key) > 6 else ''}")
                        last_error = f"Status {response.status_code}: {response.text}"
            except Exception as e:
                logger.error(f"Chat failed for model {model} with key ending in ...{api_key[-6:] if len(api_key) > 6 else ''}: {e}")
                last_error = str(e)
            
    return f"Помилка при виклику Gemini API: {last_error}"


def _fallback_response(user_message: str, analysis_context: dict | None) -> str:
    """Simple rule-based fallback when no LLM API is configured."""
    msg_lower = user_message.lower()

    if analysis_context:
        proportions = analysis_context.get("proportions", {})
        weak_zones = analysis_context.get("weak_zones", [])

        if any(word in msg_lower for word in ["результат", "аналіз", "метрик"]):
            ratio = proportions.get("shoulder_to_hip_ratio", "N/A")
            arm_sym = proportions.get("arm_symmetry", "N/A")
            leg_sym = proportions.get("leg_symmetry", "N/A")
            return (
                f"📊 Ось ваші основні метрики:\n\n"
                f"• Співвідношення плечі/талія: {ratio}\n"
                f"• Симетрія рук: {arm_sym}%\n"
                f"• Симетрія ніг: {leg_sym}%\n\n"
                f"Знайдено {len(weak_zones)} зон для покращення. "
                f"Запитайте мене про конкретну метрику для детального пояснення!"
            )

        if any(word in msg_lower for word in ["вправ", "тренуван", "рекомендац"]):
            if weak_zones:
                zone_names = [z.get("label", z.get("zone", "")) for z in weak_zones]
                return (
                    f"💪 На основі вашого аналізу, рекомендую зосередитися на:\n\n"
                    + "\n".join(f"• {z}" for z in zone_names)
                    + "\n\nЗапитайте мене про конкретну зону для детальних вправ!"
                )

    if any(word in msg_lower for word in ["привіт", "вітаю", "hello"]):
        return "Привіт! 👋 Я ваш AI-тренер. Завантажте фото для аналізу, і я допоможу з рекомендаціями!"

    return (
        "Дякую за запитання! Для найкращих рекомендацій, будь ласка:\n\n"
        "1. Завантажте фото в повний зріст\n"
        "2. Дочекайтесь аналізу\n"
        "3. Запитайте мене про результати\n\n"
        "💡 *Для повноцінних відповідей потрібен API ключ LLM (вкажіть у .env файлі).*"
    )


async def generate_recommendations(analysis_data: dict) -> list[dict]:
    """Generate exercise recommendations based on analysis results."""
    weak_zones = analysis_data.get("weak_zones", [])

    # Predefined exercise database
    EXERCISES = {
        "shoulders_back": [
            {"muscle_group": "Дельти", "exercise": "Жим гантелей стоячи", "description": "3×12, середня вага. Фокус на контрольованому русі.", "priority": 1},
            {"muscle_group": "Спина", "exercise": "Тяга верхнього блока", "description": "3×12, широкий хват. Зводьте лопатки.", "priority": 1},
            {"muscle_group": "Дельти", "exercise": "Розведення гантелей в сторони", "description": "3×15, легка вага. Лікті злегка зігнуті.", "priority": 2},
        ],
        "legs_glutes": [
            {"muscle_group": "Ноги", "exercise": "Присідання зі штангою", "description": "4×10, фокус на глибині присіду.", "priority": 1},
            {"muscle_group": "Сідниці", "exercise": "Гіперекстензія", "description": "3×15, контрольований рух.", "priority": 2},
        ],
        "arms": [
            {"muscle_group": "Руки", "exercise": "Однобічний підйом гантелі на біцепс", "description": "3×12 на кожну руку. Почніть зі слабшої.", "priority": 1},
            {"muscle_group": "Руки", "exercise": "Однобічне розгинання на трицепс", "description": "3×12 на кожну руку.", "priority": 2},
        ],
        "legs": [
            {"muscle_group": "Ноги", "exercise": "Болгарські випади", "description": "3×10 на кожну ногу. Почніть зі слабшої.", "priority": 1},
            {"muscle_group": "Ноги", "exercise": "Однобічний жим ногами", "description": "3×12 на кожну ногу.", "priority": 2},
        ],
        "posture_shoulders": [
            {"muscle_group": "Трапеції", "exercise": "Шраги з гантелями (баланс)", "description": "3×15, більше повторень на слабшу сторону.", "priority": 1},
            {"muscle_group": "Мобільність", "exercise": "Розтяжка грудних м'язів", "description": "30с кожна сторона, 3 підходи.", "priority": 1},
        ],
        "posture_hips": [
            {"muscle_group": "Core", "exercise": "Планка (бокова)", "description": "3×30с на кожну сторону.", "priority": 1},
            {"muscle_group": "Мобільність", "exercise": "Розтяжка згиначів стегна", "description": "30с на кожну сторону, 3 підходи.", "priority": 1},
        ],
        "posture_head": [
            {"muscle_group": "Шия", "exercise": "Chin tucks (притягування підборіддя)", "description": "3×15, тримайте 5с кожне повторення.", "priority": 1},
            {"muscle_group": "Верхня спина", "exercise": "Face pulls", "description": "3×15, легка вага, фокус на лопатках.", "priority": 1},
        ],
    }

    recommendations = []
    for zone in weak_zones:
        zone_key = zone.get("zone", "")
        if zone_key in EXERCISES:
            recommendations.extend(EXERCISES[zone_key])

    return recommendations


def adjust_bf_and_dryness(gemini_analysis: dict | None, height: float | None, weight: float | None) -> dict | None:
    if not gemini_analysis:
        return gemini_analysis
        
    if not height or not weight:
        return gemini_analysis
        
    # Calculate BMI
    bmi = weight / ((height / 100) ** 2)
    
    # BMI-based body fat estimation (assuming average male, age 25)
    bf_bmi = 1.20 * bmi - 10.45
    
    # Adjust for muscle mass
    muscle_mass = float(gemini_analysis.get("muscle_mass_score", 5.0))
    muscle_adjustment = (muscle_mass - 5.0) * 1.5
    bf_adjusted_bmi = bf_bmi - muscle_adjustment
    
    # Blend visual BF (from Gemini) and BMI-adjusted BF
    visual_bf = float(gemini_analysis.get("body_fat_pct", 18.0))
    blended_bf = 0.5 * visual_bf + 0.5 * bf_adjusted_bmi
    
    # Constrain to 4.0% - 45.0%
    final_bf = round(max(4.0, min(45.0, blended_bf)), 1)
    
    gemini_analysis["body_fat_pct"] = final_bf
    
    # Also adjust dryness score to be consistent with body fat
    # Map 10% BF -> 8.0, 15% BF -> 6.0, 20% BF -> 4.5, 25% BF -> 3.0
    # Let's use a linear mapping: dryness = 11.0 - 0.3 * final_bf
    final_dryness = round(max(1.0, min(10.0, 11.0 - 0.3 * final_bf)), 1)
    gemini_analysis["dryness_score"] = final_dryness
    
    return gemini_analysis


async def analyze_body_with_gemini(
    image_path: str,
    proportions: dict,
    keypoints: dict | None = None,
    user_height: float | None = None,
    user_weight: float | None = None,
) -> dict:
    """
    Calls Gemini to analyze the body image and CV proportions.
    Supports multiple API keys and automatic model fallback across gemini-3.5-flash and gemini-3.1-flash-lite.
    Returns:
      dict: {
        "body_type": str,
        "waist_shoulder_ratio": float,
        "body_fat_pct": float,
        "torso_leg_ratio": float,
        "arm_length_ratio": float,
        "corrected_keypoints": dict,
        "overall_assessment": str
      }
    """
    try:
        with open(image_path, "rb") as image_file:
            image_data = base64.b64encode(image_file.read()).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to read image file for Gemini analysis: {e}")
        return _fallback_gemini_analysis(proportions)

    mime_type = "image/jpeg"
    if image_path.lower().endswith(".png"):
        mime_type = "image/png"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"

    shoulder_to_hip_ratio = proportions.get("shoulder_to_hip_ratio", 0)
    torso_length = proportions.get("torso_length", 0)
    left_leg_length = proportions.get("left_leg_length", 0)
    right_leg_length = proportions.get("right_leg_length", 0)
    avg_leg_length = (left_leg_length + right_leg_length) / 2 if (left_leg_length and right_leg_length) else (left_leg_length or right_leg_length or 1.0)
    computed_torso_leg_ratio = round(torso_length / avg_leg_length, 3) if avg_leg_length else 0.5

    mp_keypoints_text = ""
    if keypoints:
        mp_keypoints_text = "\nКоординати ключових точок від MediaPipe (для орієнтиру, формат [x, y]):\n"
        for kp_name in [
            "nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
            "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
            "right_knee", "left_ankle", "right_ankle", "left_waist", "right_waist"
        ]:
            if kp_name in keypoints:
                kp = keypoints[kp_name]
                mp_keypoints_text += f"- {kp_name}: [{kp['x']:.3f}, {kp['y']:.3f}]\n"

    user_metrics_text = ""
    if user_height:
        user_metrics_text += f"- Введений користувачем зріст: {user_height} см\n"
    if user_weight:
        user_metrics_text += f"- Введена користувачем вага: {user_weight} кг\n"

    prompt_text = (
        "Ти — експерт з фітнесу, анатомії та аналізу тіла. Проаналізуй зображення людини та наступні виміри тіла:\n"
        f"- Співвідношення ширини плечей до ширини стегон (MediaPipe): {shoulder_to_hip_ratio:.3f}\n"
        f"- Довжина тулуба: {torso_length:.3f}\n"
        f"- Середня довжина ніг: {avg_leg_length:.3f}\n"
        f"- Розраховане співвідношення тулубу до ніг (тулуб/ноги): {computed_torso_leg_ratio:.3f}\n"
        f"{user_metrics_text}"
        f"{mp_keypoints_text}\n"
        "Будь ласка, виконай наступні завдання:\n"
        "0. ЗАГАЛЬНИЙ ПРИНЦИП ОЦІНЮВАННЯ: будь консервативним і об'єктивним. Оцінка 7.0+ у будь-якій "
        "категорії — це виняток, а не норма, і вимагає чітко видимих ознак (вени, розділені пучки м'язів, "
        "відсутність жиру в цій зоні, глибокі borozny/сепарація м'язів). Якщо є сумнів між двома сусідніми "
        "оцінками — обирай нижчу. Не компенсуй невпевненість завищенням балу. Оцінюй те, що реально видно "
        "на фото, а не потенціал чи 'загальне враження від старання людини'.\n"
        "1. Визнач тип знімка (photo_type): якщо людина сфотографована у повний зріст (видимі ноги повністю), "
        "поверни 'full_body'. Якщо це знімок тільки тулуба / верхньої частини тіла (ноги обрізані або невидимі "
        "нижче таза), поверни 'torso_only'.\n"
        "   Примітка: якщо людина вдягнена у довгі вільні штани, спортивні штани, джинси тощо, через які "
        "неможливо розрізнити об'єми та рельєф м'язів ніг, ноги вважаються неактивними для оцінки.\n"
        "2. Визнач тип тіла (ектоморф, мезоморф або ендоморф) на основі структури скелета, м'язової маси та "
        "контурів.\n"
        "3. Розрахуй точне співвідношення талії до плечей (waist-to-shoulder ratio).\n"
        "4. Дай орієнтовний відсоток підшкірного жиру (body fat percentage) на основі рельєфу пресу, грудей, "
        "рук та контурів тіла. Будь максимально реалістичним та точним, орієнтуйся на такі фітнес-стандарти "
        "для чоловіків: 8-12% (дуже сухий рельєф, кубики видно чітко, венозність), 13-15% (хороший рельєф, "
        "верхні кубики промальовуються, плоский живіт), 16-19% (середня здорова форма, живіт плоский, але без "
        "чітких кубиків, боки не випирають), 20-24% (м'яка форма, легкий животик або боки, рельєфу немає), "
        "понад 25% (виражений живіт та зайва вага). Не завищуй відсоток, якщо у користувача просто плоский "
        "живіт без видимих кубиків (це зазвичай 15-17%, а не 24%), але й не занижуй, якщо видно жирові складки "
        "на боках чи животі — це мінімум 20%+.\n"
        "5. Оціни сухість/рельєф тіла (dryness_score) від 1.0 до 10.0 за такими якорями:\n"
        "   1.0-2.5 — жирові складки, немає жодного рельєфу, контури тіла розмиті\n"
        "   3.0-4.5 — м'яка форма без прорисовки м'язів, живіт випирає або пухкий\n"
        "   5.0-6.0 — плоский живіт, але без чіткого рельєфу, м'язи вгадуються радше за формою, ніж за деталізацією\n"
        "   6.5-7.5 — помітна прорисовка окремих м'язових груп, верхні кубики преса видно\n"
        "   8.0-10.0 — змагальний рельєф, чіткі кубики по всій довжині преса, судинність\n"
        "   Будь максимально чесним, не округлюй у бік вищого балу при сумніві.\n"
        "6. Оціни м'язову масу (muscle_mass_score) від 1.0 до 10.0 за такими якорями:\n"
        "   1.0-2.5 — немає тренованості, тонкі кінцівки, форма тіла визначається лише скелетом\n"
        "   3.0-4.5 — мінімальна база, легка помітність м'язів без вираженого об'єму\n"
        "   5.0-6.0 — помірна мускулатура, типова для людини, яка регулярно тренується без спеціалізації\n"
        "   6.5-7.5 — виражена гіпертрофія, чітко помітні окремі м'язові групи\n"
        "   8.0-10.0 — змагальний рівень бодібілдингу/атлетики\n"
        "   Будь об'єктивним, не завищуй бал за 'старання' чи субʼєктивне враження без фізичних доказів на фото.\n"
        "7. Для кожної з 6 м'язових груп (muscle_groups: 'shoulders', 'chest', 'back', 'arms', 'core', 'legs') "
        "спочатку у полі 'description' коротко (укр. мовою) опиши 2-3 конкретні візуальні ознаки, які ти "
        "реально бачиш на фото (наявність/відсутність рельєфу, жирових складок, дефініції, об'єму, симетрії). "
        "Тільки після цього опису визнач 'score' (число від 1.0 до 10.0 з десятими), яке логічно випливає "
        "саме з цього опису, а не навпаки.\n"
        "   ВАЖЛИВІ ВКАЗІВКИ ДЛЯ ОЦІНОК (симетрично для завищення і заниження):\n"
        "   - Груди (chest): якщо помітні контури грудей, об'єм чи заповненість грудної клітки — онови "
        "оцінку до 6.5-8.0+. Але якщо груди плоскі, без об'єму, або є ознаки жирової тканини в ділянці грудей "
        "без м'язового контуру (псевдогінекомастія) — це 3.0-4.5, а не середнє значення 'про всяк випадок'.\n"
        "   - Ноги (legs): якщо ноги невидимі (при torso_only), для legs вкажи score = 0.0 та description = "
        "'Не видно в кадрі'. Якщо ноги видно в кадрі, але людина вдягнена у довгі вільні/широкі/спортивні "
        "штани, джинси тощо, через які неможливо об'єктивно оцінити рельєф та м'язову дефініцію стегон/литок, "
        "ОБОВ'ЯЗКОВО вкажи score = 0.0 та description = 'Не оцінено через вільний одяг (штани)'. Оцінюй ноги "
        "(score > 0.0) лише якщо користувач у шортах/плавках або обтислому одязі, де чітко видно форму м'язів.\n"
        "   - Для всіх інших груп (shoulders, back, arms, core): якщо на фото немає жодних ознак тренованості "
        "(немає рельєфу, немає помітного об'єму порівняно з рештою тіла) — оцінка має бути в діапазоні "
        "2.0-4.0, а не автоматично 5.0+.\n"
        "8. Визнач точне співвідношення тулубу до ніг (torso-to-leg ratio). Якщо людина в широких штанах, "
        "MediaPipe часто занижує довжину ніг. Візуально оціни справжнє положення стопи та п'ят і скорегуй це "
        "співвідношення (наприклад, якщо у людини довгі ноги, воно має бути 0.45-0.53, а не 0.70).\n"
        "9. Визнач співвідношення середньої довжини рук до довжини тулуба (arm-to-torso ratio). Для "
        "пропорційного тіла воно зазвичай становить 1.35-1.50.\n"
        "10. Розстав правильні координати [x, y] для 15 ключових суглобів на зображенні (від 0.0 до 1.0, де "
        "0.0 - верхній лівий кут, 1.0 - нижній правий кут). Використовуй надані координати MediaPipe як основу.\n"
        "    Особливу увагу приділи плечам, талії та тазу:\n"
        "    - Плечі (left_shoulder, right_shoulder): перемісти їх трохи вбік (розшир ширину плечей) та трохи "
        "вгору, щоб вони лежали точно на зовнішніх вершинах (кінцях) плечових суглобів на силуеті тіла.\n"
        "    - Талія (left_waist, right_waist): точки талії повинні бути розташовані нижче, безпосередньо у "
        "найвужчій частині талії на силуеті тіла. Не став їх під ребрами. Зазвичай це рівень на 60% відстані "
        "по вертикалі від плечей до тазу. Розмісти їх на лівому та правому контурах талії на цьому рівні.\n"
        "    - Таз/стегна (left_hip, right_hip): підніми їх вище на рівень реальної талії/кісток тазу "
        "(зазвичай трохи вище пояса штанів) та розшир до реальних зовнішніх меж тазу.\n"
        "    - Коліна та щиколотки (knees, ankles): підкоригуй їх вертикальне положення Y під широкими "
        "штанами, щоб скелет доходив до підлоги (рівня п'ят/взуття).\n"
        "    Намагайся зберігати симетрію лівої та правої сторін тіла (якщо людина стоїть прямо).\n"
        "11. Склади загальну оцінку та опис тіла (overall assessment) українською мовою. Опиши пропорції, "
        "симетрію, кістяк та дай короткі фітнес-рекомендації. Оцінка має чесно відображати реальний стан тіла "
        "на фото, включно з недоліками, а не лише позитивні сторони.\n"
        "12. Оціни зріст користувача (estimated_height) у см та вагу (estimated_weight) у кг. Якщо вони "
        "вказані в параметрах (Наданий/Введений зріст чи вага), просто поверни їх значення. Якщо вони не "
        "надані, візуально оціни їх за фото якнайточніше.\n\n"
        "Поверни результат строго як JSON об'єкт з наступними ключами:\n"
        "'body_type', 'waist_shoulder_ratio', 'body_fat_pct', 'torso_leg_ratio', 'arm_length_ratio', "
        "'corrected_keypoints', 'overall_assessment', 'estimated_height', 'estimated_weight'."
    )

    # Order of models to try
    models_to_try = [settings.LLM_MODEL]
    for alt_model in ["gemini-3.1-flash-lite"]:
        if alt_model not in models_to_try:
            models_to_try.append(alt_model)

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": image_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "body_type": {
                        "type": "STRING",
                        "enum": ["ектоморф", "мезоморф", "ендоморф"]
                    },
                    "photo_type": {
                        "type": "STRING",
                        "enum": ["full_body", "torso_only"]
                    },
                    "waist_shoulder_ratio": {
                        "type": "NUMBER"
                    },
                    "body_fat_pct": {
                        "type": "NUMBER"
                    },
                    "dryness_score": {
                        "type": "NUMBER"
                    },
                    "muscle_mass_score": {
                        "type": "NUMBER"
                    },
                    "muscle_groups": {
                        "type": "OBJECT",
                        "properties": {
                            "shoulders": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            },
                            "chest": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            },
                            "back": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            },
                            "arms": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            },
                            "core": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            },
                            "legs": {
                                "type": "OBJECT",
                                "properties": {
                                    "score": { "type": "NUMBER" },
                                    "description": { "type": "STRING" }
                                },
                                "required": ["score", "description"]
                            }
                        },
                        "required": ["shoulders", "chest", "back", "arms", "core", "legs"]
                    },
                    "torso_leg_ratio": {
                        "type": "NUMBER"
                    },
                    "arm_length_ratio": {
                        "type": "NUMBER"
                    },
                    "corrected_keypoints": {
                        "type": "OBJECT",
                        "properties": {
                            "nose": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_shoulder": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_shoulder": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_elbow": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_elbow": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_wrist": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_wrist": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_hip": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_hip": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_knee": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_knee": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_ankle": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_ankle": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "left_waist": { "type": "ARRAY", "items": { "type": "NUMBER" } },
                            "right_waist": { "type": "ARRAY", "items": { "type": "NUMBER" } }
                        },
                        "required": [
                            "nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
                            "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee",
                            "right_knee", "left_ankle", "right_ankle", "left_waist", "right_waist"
                        ]
                    },
                    "overall_assessment": {
                        "type": "STRING"
                    },
                    "estimated_height": {
                        "type": "NUMBER"
                    },
                    "estimated_weight": {
                        "type": "NUMBER"
                    }
                },
                "required": [
                    "body_type", "photo_type", "waist_shoulder_ratio", "body_fat_pct", "dryness_score",
                    "muscle_mass_score", "muscle_groups", "torso_leg_ratio", "arm_length_ratio",
                    "corrected_keypoints", "overall_assessment", "estimated_height", "estimated_weight"
                ]
            }
        }
    }

    # Get all API keys
    api_keys = settings.llm_api_keys or [settings.LLM_API_KEY]

    last_error = None
    for api_key in api_keys:
        if not api_key:
            continue
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        result_json = response.json()
                        candidates = result_json.get("candidates", [])
                        if candidates:
                            text_response = candidates[0]["content"]["parts"][0]["text"]
                            logger.info(f"Successfully analyzed body using model: {model}")
                            res_dict = json.loads(text_response)
                            res_dict = adjust_bf_and_dryness(res_dict, user_height, user_weight)
                            res_dict["overall_rating"] = _calculate_overall_rating(res_dict, proportions)
                            return res_dict
                    else:
                        logger.warning(f"Model {model} failed with status {response.status_code} for key ending in ...{api_key[-6:] if len(api_key) > 6 else ''}: {response.text}")
                        last_error = f"Status {response.status_code}: {response.text}"
            except Exception as e:
                logger.error(f"Failed calling model {model} with key ending in ...{api_key[-6:] if len(api_key) > 6 else ''}: {e}")
                last_error = str(e)

    logger.error(f"All Gemini models and API keys failed. Last error: {last_error}")
    return _fallback_gemini_analysis(proportions)


def _calculate_overall_rating(gemini_res: dict, proportions: dict) -> float:
    """Calculate the overall fitness score based on the formula."""
    try:
        dryness = float(gemini_res.get("dryness_score", 5.0))
        muscle_mass = float(gemini_res.get("muscle_mass_score", 5.0))
        
        # Waist score
        ratio = float(proportions.get("waist_to_shoulder_ratio", 0.80) or gemini_res.get("waist_shoulder_ratio", 0.80))
        if ratio <= 0.70:
            waist_score = 10.0
        elif ratio >= 0.95:
            waist_score = 2.0
        else:
            waist_score = 10.0 - ((ratio - 0.70) / (0.95 - 0.70)) * 8.0
            
        # Muscle groups average
        mg = gemini_res.get("muscle_groups", {})
        scores = []
        photo_type = gemini_res.get("photo_type", "full_body")
        
        groups = ["shoulders", "chest", "back", "arms", "core"]
        if photo_type == "full_body":
            groups.append("legs")
            
        for g in groups:
            if g in mg and isinstance(mg[g], dict) and "score" in mg[g]:
                val = float(mg[g]["score"])
                if g == "legs" and val <= 0.0:
                    continue
                scores.append(val)
                
        avg_mg = sum(scores) / len(scores) if scores else 5.0
        
        # Rating = 0.2 * dryness + 0.2 * muscle_mass + 0.2 * waist_score + 0.4 * average_muscle_groups
        rating = 0.2 * dryness + 0.2 * muscle_mass + 0.2 * waist_score + 0.4 * avg_mg
        return round(rating, 1)
    except Exception as e:
        logger.error(f"Error calculating overall rating: {e}")
        return 5.0


def _fallback_gemini_analysis(proportions: dict) -> dict:
    """Fallback generation using simple heuristics when API fails."""
    ratio = proportions.get("shoulder_to_hip_ratio", 1.3)
    torso_length = proportions.get("torso_length", 0.5)
    left_leg_length = proportions.get("left_leg_length", 0.8)
    right_leg_length = proportions.get("right_leg_length", 0.8)
    avg_leg_length = (left_leg_length + right_leg_length) / 2 if (left_leg_length and right_leg_length) else 0.8
    torso_leg_ratio = round(torso_length / avg_leg_length, 2) if avg_leg_length else 0.6
    
    left_arm_length = proportions.get("left_arm_length", 0.7)
    right_arm_length = proportions.get("right_arm_length", 0.7)
    avg_arm_length = (left_arm_length + right_arm_length) / 2 if (left_arm_length and right_arm_length) else 0.7
    arm_length_ratio = round(avg_arm_length / torso_length, 2) if torso_length else 1.4

    body_type = "мезоморф"
    if ratio < 1.15:
        body_type = "ендоморф"
    elif ratio > 1.45:
        body_type = "ектоморф"

    fallback_res = {
        "body_type": body_type,
        "photo_type": "full_body",
        "waist_shoulder_ratio": round(1.0 / ratio, 2) if ratio else 0.75,
        "body_fat_pct": 18.0,
        "dryness_score": 5.5,
        "muscle_mass_score": 5.0,
        "torso_leg_ratio": torso_leg_ratio,
        "arm_length_ratio": arm_length_ratio,
        "muscle_groups": {
            "shoulders": {"score": 5.5, "description": "Помірний тонус плечей."},
            "chest": {"score": 5.2, "description": "Базовий рельєф грудних м'язів."},
            "back": {"score": 5.4, "description": "Помірна ширина найширших м'язів спини."},
            "arms": {"score": 5.3, "description": "Середня м'язова витривалість рук."},
            "core": {"score": 5.8, "description": "Хороший тонус черевного преса."},
            "legs": {"score": 5.0, "description": "Нормальна пропорція стегон."}
        },
        "corrected_keypoints": {},
        "overall_assessment": (
            "Оцінка сформована автоматично (fallback через помилку API). "
            f"Аналіз пропорцій вказує на переважаючий тип тіла: {body_type}. "
            f"Співвідношення талії до плечей становить близько {round(1.0/ratio, 2) if ratio else 0.75:.2f}. "
            "Співвідношення тулуба до ніг збалансоване."
        )
    }
    fallback_res["overall_rating"] = _calculate_overall_rating(fallback_res, proportions)
    return fallback_res
