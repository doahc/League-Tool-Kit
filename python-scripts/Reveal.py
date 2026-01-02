import webbrowser
from Rengar import Rengar
from termcolor import colored


class ChampionSelectNotFoundError(Exception):
    pass


def reveal():
    """Open Porofessor.gg for current lobby"""
    rengar = Rengar()
    
    try:
        champ_select = rengar.lcu_request("GET", "/lol-champ-select/v1/session", "")

        if champ_select.status_code != 200 or "RPC_ERROR" in champ_select.text:
            print(colored("\nNot in champion select.\n", "red"))
            return None

        champ_select_data = champ_select.json()
        summ_names = []
        is_ranked = False

        # Check players in team
        if "myTeam" in champ_select_data:
            for player in champ_select_data["myTeam"]:
                # Check if ranked (hidden names)
                if player.get("nameVisibilityType") == "HIDDEN":
                    is_ranked = True
                    break

                summoner_id = player.get("summonerId")
                if summoner_id and summoner_id != "0":
                    summoner = rengar.lcu_request(
                        "GET", f"/lol-summoner/v1/summoners/{summoner_id}", ""
                    )
                    if summoner.status_code == 200:
                        summoner_data = summoner.json()
                        game_name = summoner_data.get('gameName', '')
                        tag_line = summoner_data.get('tagLine', '')
                        if game_name and tag_line:
                            summ_name = f"{game_name}%23{tag_line}"
                            summ_names.append(summ_name)

            # If ranked, get from chat participants
            if is_ranked:
                summ_names = []
                try:
                    # For ranked games, try alternative method
                    participants = rengar.lcu_request("GET", "/chat/v5/participants", "")
                    if participants.status_code == 200:
                        participants_data = participants.json()

                        if "participants" in participants_data:
                            for participant in participants_data["participants"]:
                                cid = participant.get("cid", "")
                                if "champ-select" not in cid:
                                    continue
                                    
                                game_name = participant.get('game_name', '')
                                game_tag = participant.get('game_tag', '')
                                if game_name and game_tag:
                                    summ_name = f"{game_name}%23{game_tag}"
                                    summ_names.append(summ_name)
                except Exception as e:
                    print(colored(f"Could not fetch ranked participants: {e}", "yellow"))

            # Get region
            region = ""
            get_region = rengar.lcu_request("GET", "/riotclient/region-locale", "")
            if get_region.status_code == 200:
                region_data = get_region.json()
                region = region_data.get("webRegion", "")

            if region and summ_names:
                summ_names_str = ",".join(summ_names)
                url = f"https://porofessor.gg/pregame/{region}/{summ_names_str}/soloqueue/season"
                
                # Open in browser
                webbrowser.open(url)
                return url
            else:
                print(colored("Failed to get region or summoner names", "red"))
                return None
                
    except Exception as e:
        print(colored(f"Error in reveal: {e}", "red"))
        return None


if __name__ == "__main__":
    result = reveal()
    if result:
        print(f"Opened: {result}")