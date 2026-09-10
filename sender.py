from pusher import Pusher
import time

pusher_client = Pusher(
    app_id='8886000',
    key='4f4e63ace80446d2ba91',
    secret='c1ea8e9dd1954f6ab461',
    host='localhost',
    port=8080,
    ssl=False
)

pusher_client.trigger('chat-room', 'new-message', {
    'message': 'Live instant event without refresh! ' + str(int(time.time()))
})