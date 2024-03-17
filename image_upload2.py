# The PayloadTooLargeError occurs because the request payload size exceeds the maximum allowed size configured on the server. To fix this issue, you have a few options:

# Increase Server Configuration: You can increase the maximum allowed request payload size on the server-side. For example, if you are using Express.js, you can adjust the limit option for the body parser middleware to allow larger payloads.

# Send File Directly: Instead of encoding the file content as base64 and sending it within the JSON payload, you can send the file directly as part of a multipart/form-data request. This allows you to upload files without worrying about payload size limitations.

# Here's how you can modify the Python script to send the file directly:

import requests
import sys

file_path = sys.argv[1]
file_name = file_path.split('/')[-1]

files = {'file': open(file_path, 'rb')}
data = {
    'name': file_name,
    'type': 'image',
    'isPublic': True,
    'parentId': sys.argv[3]
}
headers = {'X-Token': sys.argv[2]}

r = requests.post("http://0.0.0.0:5000/files", files=files, data=data, headers=headers)
print(r.json())

# In this script:
    # We use the files parameter in the requests.post() function to send the file directly.
    # The file is opened in binary mode and passed as a dictionary where the key is 'file' (you can change it to match your server's expectation).
    # We still send other data (such as name, type, isPublic, and parentId) as part of the request payload.
    # Ensure that your server-side code is configured to handle multipart/form-data requests properly. If you're using Express.js, you might need to use middleware like multer to handle file uploads.