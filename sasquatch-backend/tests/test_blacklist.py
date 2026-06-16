def check_blacklist(content, blacklist):
    lowered = content.lower()

    for term in blacklist:
        if term.lower() in lowered:
            return True, "blacklist"

    return False, None


def main():
    # Cas normal
    assert (
        check_blacklist(
            "Ceci est une question normale",
            ["spam", "insulte"]
        )
        == (False, None)
    )

    print("OK: contenu normal non filtré")

    # Détection insensible à la casse
    assert (
        check_blacklist(
            "Tu es vraiment une INSULTE ambulante",
            ["spam", "insulte"]
        )
        == (True, "blacklist")
    )

    print("OK: terme blacklisté détecté, insensible à la casse")

    # Liste vide
    assert (
        check_blacklist(
            "Rien à signaler ici",
            []
        )
        == (False, None)
    )

    print("OK: liste noire vide ne filtre rien")

    print()
    print("TOUS LES TESTS BLACKLIST PASSENT")


if __name__ == "__main__":
    main()
