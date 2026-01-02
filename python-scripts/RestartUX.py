from Rengar import Rengar
from termcolor import colored

rengar = Rengar()


def restart():
    """Restart League Client UX"""
    try:
        response = rengar.lcu_request("POST", '/riotclient/kill-and-restart-ux', '')
        
        if response.status_code in [200, 204]:
            print(colored("Client restart initiated.", "green"))
            return True
        else:
            print(colored(f"Error restarting client: {response.status_code}", "red"))
            return False
            
    except Exception as e:
        print(colored(f"Error: {e}", "red"))
        return False


if __name__ == "__main__":
    restart()