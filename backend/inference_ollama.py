#!/usr/bin/env python3
"""
Ollama-based Chapter Generator
EASIEST SOLUTION - No GPU/VRAM concerns!

Prerequisites:
1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
2. Pull model: ollama pull phi3:mini
"""

import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "phi3:mini"  # Change to tinyllama for even lighter model

def check_ollama():
    """Check if Ollama is running."""
    try:
        response = requests.get("http://localhost:11434/api/tags")
        return response.status_code == 200
    except:
        return False

def generate_chapters_ollama(transcript):
    """Generate chapters using Ollama."""
    
    prompt = f"""You are an AI that converts YouTube transcripts into chapters.

Examples:

Input: [00:00] Welcome [01:30] Let's start [05:00] Advanced topics [10:00] Thanks
Output:
00:00 - Introduction
01:30 - Getting Started
05:00 - Advanced Topics
10:00 - Conclusion

Input: [00:00] Hello [02:00] Variables [07:00] Functions [12:00] OOP [18:00] Bye
Output:
00:00 - Introduction
02:00 - Variables and Data Types
07:00 - Functions and Methods
12:00 - Object-Oriented Programming
18:00 - Closing

Now convert this transcript to chapters with timestamps and descriptive titles:

{transcript}

Output:"""
    
    data = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "num_predict": 300
        }
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=data, timeout=60)
        if response.status_code == 200:
            return response.json()['response'].strip()
        else:
            return f"Error: {response.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    print("=" * 80)
    print("YouTube Chapter Generator with Ollama")
    print("=" * 80)
    
    # Check if Ollama is running
    if not check_ollama():
        print("\n❌ Ollama is not running!")
        print("\nPlease start Ollama:")
        print("1. Install: curl -fsSL https://ollama.com/install.sh | sh")
        print("2. Pull model: ollama pull phi3:mini")
        print("3. Ollama should auto-start, or run: ollama serve")
        return
    
    print(f"\n✓ Ollama is running with model: {MODEL}\n")
    
    # Test transcript
    test_transcript = """
[00:00] Welcome to this comprehensive Python tutorial
[02:15] First let's understand variables and data types
[05:30] Python has several built-in data types
[08:45] Now let's move on to control flow statements
[12:00] For loops and while loops are essential
[15:30] Functions allow us to write reusable code
[18:15] We'll define functions with parameters
[22:00] Object oriented programming in Python
[25:30] Classes and objects help organize code
[28:45] Let's build a complete project
[32:00] We'll create a task manager application
[35:30] Best practices and next steps
[38:00] Thank you for watching
"""
    
    print("Testing with example transcript...")
    print("-" * 80)
    
    chapters = generate_chapters_ollama(test_transcript)
    
    print("Generated Chapters:")
    print(chapters)
    print("=" * 80)
    
    # Interactive mode
    print("\n\n🎯 Interactive Mode")
    print("Paste your transcript and press Enter twice\n")
    
    while True:
        print("\nTranscript (or 'quit' to exit):")
        lines = []
        
        while True:
            line = input()
            if line.strip().lower() in ['quit', 'exit', 'q']:
                print("\nGoodbye!")
                return
            if line.strip() == "" and lines:
                break
            if line.strip():
                lines.append(line)
        
        transcript = '\n'.join(lines).strip()
        
        if not transcript:
            continue
        
        print("\n⏳ Generating chapters...")
        result = generate_chapters_ollama(transcript)
        
        print("\n✅ Generated Chapters:")
        print("-" * 80)
        print(result)
        print("-" * 80)

if __name__ == "__main__":
    main()
