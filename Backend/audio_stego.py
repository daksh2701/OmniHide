import wave
import os

DELIMITER = "#####OMNIHIDE#####"

def encode_audio(audio_path, secret_data, output_path):
    """Encrypted data ko audio (.wav) ke LSB me chupata hai"""
    song = wave.open(audio_path, mode='rb')
    # Audio ke saare frames ko bytes me padhna
    frame_bytes = bytearray(list(song.readframes(song.getnframes())))
    
    secret_data += DELIMITER
    # Convert secret text into binary
    binary_data = ''.join([format(ord(i), "08b") for i in secret_data])
    
    if len(binary_data) > len(frame_bytes):
        raise ValueError("Audio file is too small for this message!")

    # Change LSB of each byte of the audio data to hide the secret message
    for i in range(len(binary_data)):
        frame_bytes[i] = (frame_bytes[i] & 254) | int(binary_data[i])
        
    # Save the new audio file with hidden message
    frame_modified = bytes(frame_bytes)
    with wave.open(output_path, 'wb') as fd:
        fd.setparams(song.getparams())
        fd.writeframes(frame_modified)
    
    song.close()
    return output_path

def decode_audio(audio_path):
    """Audio se hidden data bahar nikalta hai"""
    song = wave.open(audio_path, mode='rb')
    frame_bytes = bytearray(list(song.readframes(song.getnframes())))
    
    # Extracting the LSB of each byte to get the binary data
    extracted_bin = [str(frame_bytes[i] & 1) for i in range(len(frame_bytes))]
    binary_data = "".join(extracted_bin)
    
    # Convert 8-bit binary data to characters
    all_bytes = [binary_data[i: i+8] for i in range(0, len(binary_data), 8)]
    decoded_data = ""
    for byte in all_bytes:
        decoded_data += chr(int(byte, 2))
        if decoded_data[-len(DELIMITER):] == DELIMITER:
            return decoded_data[:-len(DELIMITER)]
            
    song.close()
    raise ValueError("No hidden data found!")