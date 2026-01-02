import sys
import json
from Rengar import Rengar, check_league_client
from AutoAccept import autoaccept
from InstalockAutoban import InstalockAutoban
from disconnect_reconnect_chat import Chat
from RemoveFriends import remove_all_friends
from Badges import change_profile_badges
from Icons import change_profile_icon
from Backgrounds import change_profile_background
from Riotidchanger import change_riotid
from StatusChanger import change_status
from Reveal import reveal
from Dodge import dodge
from RestartUX import restart

# Initialize components
rengar = Rengar()
auto_accept = autoaccept()
instalock_autoban = InstalockAutoban()
chat = Chat()


def check_client():
    """Check if League client is running"""
    try:
        port, token = check_league_client()
        return {"success": True, "connected": True, "port": port}
    except:
        return {"success": True, "connected": False}


def get_summoner_info():
    """Get current summoner information"""
    try:
        summoner_resp = rengar.lcu_request("GET", "/lol-summoner/v1/current-summoner", "")
        if summoner_resp.status_code == 200:
            summoner = summoner_resp.json()
            ign = f"{summoner.get('gameName', 'Unknown')}#{summoner.get('tagLine', 'Unknown')}"
            level = summoner.get("summonerLevel", "Unknown")
        else:
            return {"success": False, "error": "Failed to get summoner data"}

        region_resp = rengar.lcu_request("GET", "/riotclient/region-locale", "")
        if region_resp.status_code == 200:
            region_data = region_resp.json()
            region = region_data.get("webRegion", "Unknown")
        else:
            region = "Unknown"

        ranked_resp = rengar.lcu_request("GET", "/lol-ranked/v1/current-ranked-stats", "")
        if ranked_resp.status_code == 200:
            ranked_data = ranked_resp.json()
            solo_queue = next(
                (q for q in ranked_data.get("queues", []) if q.get("queueType") == "RANKED_SOLO_5x5"),
                None
            )
            if solo_queue:
                tier = solo_queue.get("tier", "Unranked")
                division = solo_queue.get("division", "")
                lp = solo_queue.get("leaguePoints", 0)
                elo = f"{tier} {division} {lp} LP" if tier != "Unranked" else "Unranked"
            else:
                elo = "Unranked"
        else:
            elo = "Unknown"

        return {
            "success": True,
            "ign": ign,
            "region": region,
            "level": level,
            "elo": elo
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def toggle_auto_accept_func(enabled):
    """Toggle auto accept"""
    try:
        auto_accept.auto_accept_enabled = enabled
        return {"success": True, "enabled": enabled}
    except Exception as e:
        return {"success": False, "error": str(e)}


def set_instalock_func(champion_name, enabled):
    """Set instalock champion"""
    try:
        if enabled:
            success = instalock_autoban.set_instalock_champion(champion_name)
            if success:
                instalock_autoban.instalock_enabled = True
                return {"success": True, "champion": champion_name}
            else:
                return {"success": False, "error": "Champion not found"}
        else:
            instalock_autoban.instalock_enabled = False
            return {"success": True, "enabled": False}
    except Exception as e:
        return {"success": False, "error": str(e)}


def set_autoban_func(champion_name, enabled, protect_ban=True):
    """Set auto ban champion"""
    try:
        if enabled:
            success = instalock_autoban.set_auto_ban_champion(champion_name)
            if success:
                instalock_autoban.auto_ban_enabled = True
                instalock_autoban.options.avoid_ally_hovers = protect_ban
                return {"success": True, "champion": champion_name, "protectBan": protect_ban}
            else:
                return {"success": False, "error": "Champion not found"}
        else:
            instalock_autoban.auto_ban_enabled = False
            return {"success": True, "enabled": False}
    except Exception as e:
        return {"success": False, "error": str(e)}


def toggle_chat_func(disconnect):
    """Toggle chat connection"""
    try:
        if disconnect:
            success = chat.disconnect()
        else:
            success = chat.reconnect()
        
        return {"success": success, "disconnected": disconnect}
    except Exception as e:
        return {"success": False, "error": str(e)}


def change_icon_func(icon_id):
    """Change profile icon"""
    try:
        success = change_profile_icon(icon_id)
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}


def change_background_func(skin_id):
    """Change profile background - FIXED VERSION WITH DEBUG"""
    try:
        # Validate skin_id
        skin_id = int(skin_id)
        print(f"[Background] Attempting to change background to skin ID: {skin_id}")
        
        # Direct API call with proper body structure
        try:
            body = {
                "key": "backgroundSkinId",
                "value": skin_id
            }
            
            print(f"[Background] Request body: {body}")
            print(f"[Background] Calling POST /lol-summoner/v1/current-summoner/summoner-profile")
            
            response = rengar.lcu_request('POST', "/lol-summoner/v1/current-summoner/summoner-profile", body)
            
            print(f"[Background] Response status: {response.status_code}")
            print(f"[Background] Response headers: {dict(response.headers)}")
            print(f"[Background] Response body: {response.text}")
            
            if response.status_code in [200, 204]:
                print(f"[Background] ✓ Background changed successfully to {skin_id}")
                return {"success": True}
            elif response.status_code == 400:
                print(f"[Background] ✗ Bad Request - Invalid skin ID or wrong format")
                return {"success": False, "error": "Invalid skin ID or request format"}
            elif response.status_code == 404:
                print(f"[Background] ✗ Not Found - Endpoint may be incorrect")
                return {"success": False, "error": "API endpoint not found"}
            else:
                error_msg = f"HTTP {response.status_code}"
                if response.text:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get('message', error_msg)
                        print(f"[Background] Error details: {error_data}")
                    except:
                        print(f"[Background] Raw error: {response.text}")
                
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            print(f"[Background] ✗ Exception during API call: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
            
    except ValueError:
        print(f"[Background] ✗ Invalid skin ID format")
        return {"success": False, "error": "Invalid skin ID format"}
    except Exception as e:
        print(f"[Background] ✗ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def change_riot_id_func(name, tag):
    """Change Riot ID"""
    try:
        if not name or not tag:
            return {"success": False, "error": "Name and tag required"}
        
        if len(name) > 16:
            return {"success": False, "error": "Name too long (max 16)"}
        
        if len(tag) > 5:
            return {"success": False, "error": "Tag too long (max 5)"}
        
        success = change_riotid(name, tag)
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}


def change_status_func(status_message):
    """Change status message"""
    try:
        success = change_status(status_message)
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}


def reveal_lobby_func():
    """Open Porofessor.gg for current lobby"""
    try:
        url = reveal()
        if url:
            return {"success": True, "url": url}
        else:
            return {"success": False, "error": "Not in champion select"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def dodge_func():
    """Dodge current game"""
    try:
        success = dodge()
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}


def remove_friends_func():
    """Remove all friends"""
    try:
        response = rengar.lcu_request("GET", "/lol-chat/v1/friends", "")
        
        if response.status_code == 200:
            friends = response.json()
            removed_count = 0
            
            for friend in friends:
                friend_id = friend.get("pid")
                try:
                    delete_response = rengar.lcu_request("DELETE", f"/lol-chat/v1/friends/{friend_id}", "")
                    if delete_response.status_code in [200, 204]:
                        removed_count += 1
                except:
                    pass
            
            return {"success": True, "removed": removed_count}
        
        return {"success": False, "error": "Failed to get friends list"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def restart_client_func():
    """Restart League client UX"""
    try:
        success = restart()
        return {"success": success}
    except Exception as e:
        return {"success": False, "error": str(e)}


def change_badges_func():
    """Change profile badges"""
    try:
        change_profile_badges()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Main execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No method specified"}))
        sys.exit(1)
    
    method = sys.argv[1]
    args = sys.argv[2:] if len(sys.argv) > 2 else []
    
    result = None
    
    try:
        if method == "check_client":
            result = check_client()
            
        elif method == "get_summoner_info":
            result = get_summoner_info()
            
        elif method == "toggle_auto_accept":
            enabled = args[0].lower() == "true" if args else False
            result = toggle_auto_accept_func(enabled)
            
        elif method == "set_instalock":
            champion = args[0] if args else ""
            enabled = args[1].lower() == "true" if len(args) > 1 else False
            result = set_instalock_func(champion, enabled)
            
        elif method == "set_autoban":
            champion = args[0] if args else ""
            enabled = args[1].lower() == "true" if len(args) > 1 else False
            protect = args[2].lower() == "true" if len(args) > 2 else True
            result = set_autoban_func(champion, enabled, protect)
            
        elif method == "toggle_chat":
            disconnect = args[0].lower() == "true" if args else False
            result = toggle_chat_func(disconnect)
            
        elif method == "change_icon":
            icon_id = args[0] if args else None
            result = change_icon_func(icon_id)
            
        elif method == "change_background":
            skin_id = args[0] if args else None
            result = change_background_func(skin_id)
            
        elif method == "change_riot_id":
            name = args[0] if args else ""
            tag = args[1] if len(args) > 1 else ""
            result = change_riot_id_func(name, tag)
            
        elif method == "change_status":
            status = args[0] if args else ""
            result = change_status_func(status)
            
        elif method == "reveal_lobby":
            result = reveal_lobby_func()
            
        elif method == "dodge":
            result = dodge_func()
            
        elif method == "change_badges":
            result = change_badges_func()
            
        elif method == "remove_friends":
            result = remove_friends_func()
            
        elif method == "restart_client":
            result = restart_client_func()
            
        else:
            result = {"success": False, "error": f"Unknown method: {method}"}
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)