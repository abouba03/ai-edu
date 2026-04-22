import asyncio
import json
import websockets

CODE = '''def carre(x):
    return x * x

resultats = []
for i in range(10):
    resultats.append(carre(i))

resultats
'''

async def main():
    uri = 'ws://127.0.0.1:8002/ws/console'
    async with websockets.connect(uri, open_timeout=5) as ws:
        await ws.send(json.dumps({'code': CODE}))
        for _ in range(20):
            msg = await ws.recv()
            print(msg)
            if '"type":"exit"' in msg.replace(' ', ''):
                break

asyncio.run(main())
