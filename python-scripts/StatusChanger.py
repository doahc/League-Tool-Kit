from termcolor import colored
from Rengar import Rengar


def change_status(status_message=None):
    """Change status message"""
    api = Rengar()

    if status_message is None:
        print(
            colored(
                "Paste your status below. Type 'OK!' on a new line when finished:\n",
                "magenta"
            )
        )

        lines = []
        while True:
            try:
                line = input()
                if line.strip() == "OK!":
                    break
                lines.append(line)
            except EOFError:
                break

        status_message = "\n".join(lines)

    if not status_message:
        print(colored("Status message cannot be empty.", "red"))
        return False

    body = {"statusMessage": status_message}
    
    try:
        req = api.lcu_request("PUT", "/lol-chat/v1/me", body)
        
        if req.status_code in [200, 204]:
            print(colored("Status changed successfully!", "green"))
            return True
        else:
            print(colored(f"Error: {req.status_code}", "red"))
            print(colored(f"Details: {req.text}", "red"))
            return False
            
    except Exception as e:
        print(colored(f"Error changing status: {e}", "red"))
        return False


if __name__ == "__main__":
    change_status()