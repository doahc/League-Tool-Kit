from Rengar import Rengar

rengar = Rengar()


class Chat:
    def __init__(self):
        self.chat_state = self.return_disconnect()

    def return_disconnect(self):
        """Check if chat is currently disconnected"""
        try:
            req = rengar.lcu_request("GET", "/chat/v1/session", "")
            if req.status_code == 200:
                req_data = req.json()
                return req_data.get("state") == "disconnected"
            return False
        except Exception:
            return False

    def disconnect(self):
        """Disconnect from chat"""
        try:
            body = {"config": "disable"}
            response = rengar.lcu_request("POST", "/chat/v1/suspend", body)
            return response.status_code in [200, 204]
        except Exception as e:
            print(f"Error disconnecting chat: {e}")
            return False

    def reconnect(self):
        """Reconnect to chat"""
        try:
            response = rengar.lcu_request("POST", "/chat/v1/resume", "")
            return response.status_code in [200, 204]
        except Exception as e:
            print(f"Error reconnecting chat: {e}")
            return False

    def toggle_chat(self):
        """Toggle chat state"""
        self.chat_state = not self.chat_state
        if self.chat_state:
            return self.disconnect()
        else:
            return self.reconnect()

    def return_state(self):
        """Return current chat state as string"""
        return "OFF" if self.chat_state else "ON"