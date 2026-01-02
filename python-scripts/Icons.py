from termcolor import colored
from Rengar import Rengar


def change_profile_icon(icon_id=None):
    """Change profile icon by ID"""
    rengar = Rengar()

    if icon_id is None:
        icon_id = input(colored("Type the icon ID (1 - 5000): \n", "magenta"))

    try:
        icon_id = int(icon_id)
    except ValueError:
        print(colored("Please insert a valid number.", "red"))
        return False

    body = {"profileIconId": icon_id}

    try:
        response = rengar.lcu_request("PUT", "/lol-summoner/v1/current-summoner/icon", body)
        if response.status_code in [200, 201]:
            print(colored(f"Icon successfully changed to {icon_id}", "green"))
            return True
        else:
            print(colored(f"Error: {response.status_code}", "red"))
            print(colored(f"Details: {response.text}", "red"))
            return False
    except Exception as e:
        print(colored(f"Error sending request: {e}", "red"))
        return False


if __name__ == "__main__":
    change_profile_icon()