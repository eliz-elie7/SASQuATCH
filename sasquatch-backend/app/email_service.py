"""
Envoi d'e-mails transactionnels (activation de compte).

Utilise le module standard smtplib -- pas de dépendance supplémentaire
nécessaire. Conçu pour rester simple : pas de file d'attente, pas de
retry automatique, l'envoi est synchrone et bloquant. Suffisant pour le
volume de ce projet (création de comptes ponctuelle par l'admin).
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# URL du frontend où l'utilisateur finalise son activation. À adapter
# quand le frontend sera déployé (actuellement en dev local).
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


def send_activation_email(to_email: str, prenom: str, activation_token: str, activation_code: str) -> None:
    """
    Envoie l'e-mail d'activation contenant le lien à usage unique ET un
    code court alternatif (§2.1.1). Le code est utile si le lien ne
    fonctionne pas (client mail coupant les URLs, téléphone ouvrant le
    mauvais navigateur, etc.).
    """
    activation_link = f"{FRONTEND_BASE_URL}/activate?token={activation_token}"

    message = MIMEMultipart("alternative")
    message["Subject"] = "Activation de votre compte SASQuATCH"
    message["From"] = SMTP_USER
    message["To"] = to_email

    text_body = (
        f"Bonjour {prenom},\n\n"
        f"Un compte SASQuATCH a été créé pour vous.\n"
        f"Activez-le et choisissez votre mot de passe via ce lien :\n"
        f"{activation_link}\n\n"
        f"Ce lien est valable 48 heures et à usage unique.\n\n"
        f"Si le lien ne fonctionne pas, rendez-vous sur :\n"
        f"{FRONTEND_BASE_URL}/activate\n"
        f"et saisissez ce code d'activation : {activation_code}\n"
    )
    html_body = f"""
    <html><body>
      <p>Bonjour {prenom},</p>
      <p>Un compte SASQuATCH a été créé pour vous.</p>
      <p><a href="{activation_link}">Cliquez ici pour activer votre compte</a></p>
      <p>Ce lien est valable 48 heures et à usage unique.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
      <p style="color:#555">Si le lien ne fonctionne pas, rendez-vous sur
      <strong>{FRONTEND_BASE_URL}/activate</strong> et saisissez ce code :</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;font-family:monospace">
        {activation_code}
      </p>
    </body></html>
    """

    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, message.as_string())