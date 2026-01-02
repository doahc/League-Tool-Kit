from Rengar import Rengar
from termcolor import colored

rengar = Rengar()


def change_riotid(name=None, tag=None):
    """Change Riot ID (game name and tag line)"""
    
    if name is None:
        name = input(colored("Type the new name: ", "magenta"))
    
    if tag is None:
        tag = input(colored("Type the new tag: ", "magenta"))

    # Validation
    if not tag or not name:
        print(colored("Insert a valid name/tag.", "red"))
        return False
        
    if len(name) > 16:
        print(colored("Name length is bigger than 16.", "red"))
        return False
        
    if len(tag) > 5:
        print(colored("Tag length is bigger than 5.", "red"))
        return False

    body = {
        "gameName": name,
        "tagLine": tag
    }
    
    try:
        change = rengar.lcu_request("POST", "/lol-summoner/v1/save-alias", body)
        
        if change.status_code in [200, 204]:
            print(colored(f"Riot ID changed to: {name}#{tag}", "green"))
            return True
        else:
            print(colored(f"Error: {change.status_code}", "red"))
            print(colored(f"Details: {change.text}", "red"))
            return False
            
    except Exception as e:
        print(colored(f"Error changing Riot ID: {e}", "red"))
        return False


if __name__ == "__main__":
    change_riotid()