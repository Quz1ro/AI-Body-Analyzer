"""
Email verification service — sends verification emails via Gmail SMTP.
Uses Python's standard smtplib (no extra dependencies).
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

logger = logging.getLogger(__name__)


def _build_verification_html(verify_url: str) -> str:
    """Build a styled HTML email body for email verification."""
    return f"""\
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="
        background:linear-gradient(145deg,rgba(30,30,45,0.95),rgba(20,20,35,0.98));
        border:1px solid rgba(255,255,255,0.06);
        border-radius:16px;padding:40px;
      ">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="
            font-size:28px;font-weight:800;
            background:linear-gradient(135deg,#00d4aa,#7c3aed,#3b82f6);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;
            background-clip:text;
          ">AI Body Analyzer</div>
        </td></tr>

        <!-- Title -->
        <tr><td align="center" style="padding-bottom:16px;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">
            Підтвердження email
          </h1>
        </td></tr>

        <!-- Text -->
        <tr><td align="center" style="padding-bottom:32px;">
          <p style="color:#a0a0b8;font-size:14px;line-height:1.6;margin:0;">
            Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити
            вашу електронну пошту та отримати доступ до всіх функцій.
          </p>
        </td></tr>

        <!-- Button -->
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="{verify_url}" style="
            display:inline-block;padding:14px 40px;
            background:linear-gradient(135deg,#00d4aa,#7c3aed);
            color:#ffffff;font-size:15px;font-weight:700;
            text-decoration:none;border-radius:10px;
            box-shadow:0 4px 20px rgba(0,212,170,0.3);
          ">Підтвердити email</a>
        </td></tr>

        <!-- Alt link -->
        <tr><td align="center" style="padding-bottom:24px;">
          <p style="color:#6b6b80;font-size:12px;margin:0;">
            Або скопіюйте посилання:<br>
            <a href="{verify_url}" style="color:#7c3aed;word-break:break-all;font-size:11px;">
              {verify_url}
            </a>
          </p>
        </td></tr>

        <!-- Expiry notice -->
        <tr><td align="center">
          <p style="color:#4a4a5e;font-size:11px;margin:0;">
            Посилання дійсне протягом {settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS} годин.
            Якщо ви не реєструвалися — проігноруйте цей лист.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def send_verification_email(to_email: str, token: str) -> bool:
    """
    Send a verification email via Gmail SMTP.
    Returns True on success, False on failure.
    If SMTP credentials are not configured, logs the verification URL instead.
    """
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"

    # Dev mode: no SMTP configured — just log the URL
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "SMTP not configured. Verification URL for %s: %s",
            to_email,
            verify_url,
        )
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Підтвердіть вашу електронну пошту — AI Body Analyzer"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email

    # Plain text fallback
    text_body = (
        f"Підтвердіть вашу електронну пошту, перейшовши за посиланням:\n\n"
        f"{verify_url}\n\n"
        f"Посилання дійсне протягом {settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS} годин."
    )
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(_build_verification_html(verify_url), "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", to_email, e)
        return False
