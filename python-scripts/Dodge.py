from Rengar import Rengar

rengar = Rengar()


def dodge():
    """Dodge the current champion select game"""
    try:
        response = rengar.lcu_request(
            "POST",
            '/lol-login/v1/session/invoke?destination=lcdsServiceProxy&method=call&args=["","teambuilder-draft","quitV2",""]',
            ""
        )
        return response.status_code in [200, 204]
    except Exception as e:
        print(f"Error dodging game: {e}")
        return False


if __name__ == "__main__":
    if dodge():
        print("Successfully dodged the game")
    else:
        print("Failed to dodge")