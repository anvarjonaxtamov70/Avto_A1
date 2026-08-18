from google import genai

client = genai.Client(api_key="AIzaSyBfKum-6jf381yKy7r2pfHHpuYWZXGLajQ")

for f in client.files.list():
    client.files.delete(name=f.name)
    print(f"O'chirildi: {f.name}")

print("Hammasi tozalandi ✅")