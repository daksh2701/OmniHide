import os

DELIMITER = b"#####OMNIHIDE_VIDEO#####"

def encode_video(video_path, secret_data, output_path):
    secret_bytes = secret_data.encode('utf-8')
    
    # Read the original video content
    with open(video_path, 'rb') as video_file:
        video_content = video_file.read()
        
    # Save the new video with the secret data appended at the end
    with open(output_path, 'wb') as output_file:
        output_file.write(video_content)
        output_file.write(DELIMITER)
        output_file.write(secret_bytes)
        
    return output_path

def decode_video(video_path):
    with open(video_path, 'rb') as video_file:
        video_content = video_file.read()
        
    # Check whether the delimiter exists in the video content
    if DELIMITER in video_content:
        # Split the content at the delimiter and take the last part as the secret data
        secret_bytes = video_content.split(DELIMITER)[-1]
        return secret_bytes.decode('utf-8')
    else:
        raise ValueError("There is no hidden data in this video or the file is corrupted!")