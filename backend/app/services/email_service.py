"""
Email verification service — sends verification emails via Gmail SMTP.
Uses Python's standard smtplib (no extra dependencies).
"""

import smtplib
import logging
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

logger = logging.getLogger(__name__)


def _build_verification_html(verify_url: str) -> str:
    """Build a styled HTML email body for email verification."""
    return f"""\
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Підтвердження email</title>
</head>
<body style="margin:0;padding:0;background-color:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080c14;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="
          width:100%;
          max-width:480px;
          background-color:#131b2e;
          border-top:4px solid #00d4aa;
          border-left:1px solid #1f293d;
          border-right:1px solid #1f293d;
          border-bottom:1px solid #1f293d;
          border-radius:12px;
          box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);
        ">
          <tr>
            <td style="padding:40px 32px;" align="center">
              
              <!-- Logo -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                    AI <span style="color:#00d4aa;">Body Analyzer</span>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.01em;">
                      Підтвердження email
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Text -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
                      Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити
                      вашу електронну пошту та отримати доступ до всіх функцій додатку.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="{verify_url}" style="
                      display:inline-block;
                      background-color:#00d4aa;
                      color:#080c14;
                      font-size:15px;
                      font-weight:700;
                      text-decoration:none;
                      padding:14px 36px;
                      border-radius:8px;
                      box-shadow:0 4px 12px rgba(0,212,170,0.25);
                    ">Підтвердити email</a>
                  </td>
                </tr>
              </table>

              <!-- Alt Link Block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="
                background-color:#0f172a;
                border:1px solid #1e293b;
                border-radius:8px;
                margin-bottom:24px;
              ">
                <tr>
                  <td style="padding:16px;" align="center">
                    <p style="color:#64748b;font-size:12px;margin:0 0 8px 0;line-height:1.4;">
                      Якщо кнопка не працює, скопіюйте це посилання:
                    </p>
                    <a href="{verify_url}" style="color:#38bdf8;word-break:break-all;font-size:11px;text-decoration:underline;">
                      {verify_url}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="color:#64748b;font-size:11px;margin:0;line-height:1.5;">
                      Посилання дійсне протягом {settings.EMAIL_VERIFY_TOKEN_EXPIRE_HOURS} годин.<br>
                      Якщо ви не реєструвалися — просто проігноруйте цей лист.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_verification_email(to_email: str, token: str) -> bool:
    """
    Send a verification email via Gmail SMTP.
    Returns True on success, False on failure.
    If SMTP credentials are not configured, logs the verification URL instead.
    Includes a delay before sending to avoid Gmail rate-limiting,
    and retry logic with exponential backoff (up to 3 attempts).
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

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        # Delay before sending to avoid Gmail SMTP rate-limiting
        delay = 2 * attempt  # 2s, 4s, 6s
        logger.info(
            "Attempt %d/%d: waiting %ds before sending to %s",
            attempt, max_retries, delay, to_email,
        )
        time.sleep(delay)

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
            logger.info("Verification email sent to %s (attempt %d)", to_email, attempt)
            return True
        except Exception as e:
            logger.error(
                "Failed to send verification email to %s (attempt %d/%d): %s",
                to_email, attempt, max_retries, e,
            )
            if attempt == max_retries:
                return False
            # Continue to next retry with increased delay

    return False
