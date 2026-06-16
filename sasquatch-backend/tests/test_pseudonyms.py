import os
import base64
import secrets
import sys
import types

# Configuration minimale requise par crypto.py
os.environ["ENCRYPTION_KEY"] = base64.b64encode(
    secrets.token_bytes(32)
).decode()

os.environ["HMAC_SEARCH_KEY"] = base64.b64encode(
    secrets.token_bytes(32)
).decode()

# Mock passlib pour éviter les problèmes bcrypt
fake_passlib = types.ModuleType("passlib")
fake_passlib_context = types.ModuleType("passlib.context")


class FakeCryptContext:
    def __init__(self, **kwargs):
        pass


fake_passlib_context.CryptContext = FakeCryptContext

sys.modules["passlib"] = fake_passlib
sys.modules["passlib.context"] = fake_passlib_context

# Import du projet
sys.path.insert(0, ".")

from app import crypto


def main():
    user_id = "5e6fae48-6c2d-4b9f-bc10-d4afa4689399"

    # Session 1
    s1 = crypto.generate_session_secret()

    p1_session1 = crypto.generate_pseudonym(s1, user_id)
    p1_session1_again = crypto.generate_pseudonym(s1, user_id)

    assert p1_session1 == p1_session1_again, (
        "FAIL: le pseudonyme devrait être stable dans une même session"
    )

    print(
        "OK: pseudonyme stable pour le même (secret, user_id):",
        p1_session1,
    )

    # Session 2
    s2 = crypto.generate_session_secret()

    p1_session2 = crypto.generate_pseudonym(s2, user_id)

    assert p1_session2 != p1_session1, (
        "FAIL: le pseudonyme devrait changer entre deux sessions"
    )

    print(
        "OK: pseudonyme différent pour le même user entre deux sessions:",
        p1_session2,
    )

    # Deux étudiants différents
    user_id_2 = "a1b2c3d4-0000-0000-0000-000000000000"

    p2_session1 = crypto.generate_pseudonym(s1, user_id_2)

    assert p2_session1 != p1_session1, (
        "FAIL: deux users différents ne devraient pas avoir le même pseudo"
    )

    print(
        "OK: deux étudiants ont des pseudonymes différents dans la même session"
    )

    # Codes de session
    codes = {
        crypto.generate_join_code()
        for _ in range(20)
    }

    assert all(len(code) == 6 for code in codes)

    ambiguous = set("0OI1L")

    assert not any(
        set(code) & ambiguous
        for code in codes
    ), "FAIL: caractères ambigus présents"

    print(
        "OK: 20 codes de session générés, tous à 6 caractères, "
        "sans ambiguïté visuelle:",
        list(codes)[:5]
    )

    print()
    print("TOUS LES TESTS PSEUDONYMES PASSENT")


if __name__ == "__main__":
    main()
