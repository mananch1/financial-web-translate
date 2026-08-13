import httpx
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NSEClient:
    def __init__(self, base_url):
        self.base_url = base_url

    def get_data(self, endpoint):
        try:
            response = httpx.get(self.base_url + endpoint, timeout=15.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            return None
        except Exception as e:
            logger.error(f"Error: {e}")
            return None

    def post_data(self, endpoint, data):
        try:
            response = httpx.post(self.base_url + endpoint, json=data, timeout=15.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            return None
        except Exception as e:
            logger.error(f"Error: {e}")
            return None

# Example usage:
if __name__ == "__main__":
    client = NSEClient("https://www.nseindia.com/")
    data = client.get_data("api/option-chain-equities?symbol=INFY")
    print(data)