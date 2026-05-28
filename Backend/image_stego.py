import cv2
import numpy as np

# Secret MArk 
DELIMITER = "#####OMNIHIDE#####"

def text_to_binary(text):
    return ''.join([format(ord(i), "08b") for i in text])

def encode_image(image_path, secret_data, output_path):

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to load the image. PLease check the format.")
        
    secret_data += DELIMITER
    binary_secret_data = text_to_binary(secret_data)
    data_len = len(binary_secret_data)
    
    max_bytes = image.shape[0] * image.shape[1] * 3 // 8
    if len(secret_data) > max_bytes:
        raise ValueError("Error: Data is too large for the image!")

    # Converting the image to a flat array for faster processing
    flat_image = image.flatten()
    
    for i in range(data_len):
        pixel_binary = format(flat_image[i], "08b")
        new_bit = pixel_binary[:-1] + binary_secret_data[i]
        flat_image[i] = int(new_bit, 2)

    # Convert back to the original shape and save the image
    stego_image = flat_image.reshape(image.shape)
    cv2.imwrite(output_path, stego_image)
    return output_path

def decode_image(image_path):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to load the image. Please check the format.")
        
    binary_data = ""
    decoded_data = ""

    # Converting the image to a flat array for faster processing
    flat_image = image.flatten()
    
    for pixel_value in flat_image:
        # Take out last bit 
        binary_data += format(pixel_value, "08b")[-1]
        
        # Convert every 8 bits to a character
        if len(binary_data) == 8:
            decoded_data += chr(int(binary_data, 2))
            binary_data = "" # Reset for next letter
            
            # Check for delimiter to know when to stop
            if decoded_data.endswith(DELIMITER):
                return decoded_data[:-len(DELIMITER)]
                
    raise ValueError("No hidden data found in the image!")