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


def send_activation_email(to_email: str, prenom: str, activation_token: str) -> None:
    """
    Envoie l'e-mail d'activation contenant le lien à usage unique
    (§2.1.1). Lève une exception si l'envoi échoue -- à appeler dans un
    bloc try/except côté route appelante pour ne pas faire échouer toute
    la création de compte si seul l'e-mail a un problème (voir note dans
    admin.py).
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
        f"Ce lien est valable 48 heures et à usage unique.\n"
    )
    html_body = f"""
    <html><body>
      <p>Bonjour {prenom},</p>
      <p>Un compte SASQuATCH a été créé pour vous.</p>
      <p><a href="{activation_link}">Cliquez ici pour activer votre compte</a></p>
      <p>Ce lien est valable 48 heures et à usage unique.</p>
    </body></html>
    """

    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, message.as_string())