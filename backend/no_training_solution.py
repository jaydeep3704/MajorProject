#!/usr/bin/env python3
"""
NO TRAINING NEEDED - Use Pre-trained Phi-3-Mini
Perfect for RTX 3050 4GB when you don't want to train

This uses few-shot learning with a pre-trained model.
Works immediately without any training!
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

print("=" * 80)
print("YouTube Chapter Generator - No Training Required")
print("=" * 80)
print("\nLoading Phi-3-Mini model...")

MODEL_NAME = "microsoft/Phi-3-mini-4k-instruct"

# Load with 4-bit quantization
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16
)

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

print("✓ Model loaded! (Using ~2GB VRAM)\n")

def generate_chapters(transcript):
    """Generate chapters using few-shot learning."""
    
    prompt = f"""<|system|>
You are an AI that converts YouTube transcripts into clean chapter listings.<|end|>
<|user|>
Here are examples of converting transcripts to chapters:

Example 1:
Transcript: [00:00] Welcome to this tutorial [01:30] Let's start with basics [05:00] Advanced concepts [10:00] Conclusion
Chapters:
00:00 - Introduction and Welcome
01:30 - Getting Started with Basics
05:00 - Advanced Concepts and Techniques
10:00 - Conclusion and Summary

Example 2:
Transcript: [00:00] Hello everyone [02:15] First topic is variables [07:30] Now functions [12:00] Object oriented programming [18:00] Thank you
Chapters:
00:00 - Introduction
02:15 - Variables and Data Types
07:30 - Functions and Methods
12:00 - Object-Oriented Programming
18:00 - Closing Remarks

Now convert this transcript to chapters:
Transcript: {transcript}
Chapters:<|end|>
<|assistant|>
"""
    
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048).to("cuda")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=300,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id
        )
    
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Extract only the generated chapters
    if "<|assistant|>" in result:
        result = result.split("<|assistant|>")[-1].strip()
    
    return result

# Test with example transcript
test_transcript = """
[00:00] Welcome to this comprehensive Python tutorial
[00:45] In this video we will cover everything you need to know about Python
[02:15] First let's understand variables and data types
[05:30] Python has several built-in data types like integers strings and lists
[08:45] Now let's move on to control flow with if statements and loops
[12:00] For loops and while loops are essential for iteration
[15:30] Functions allow us to write reusable code
[18:15] We'll define functions with def keyword and parameters
[22:00] Object oriented programming is a key paradigm in Python
[25:30] Classes and objects help organize code
[28:45] Let's build a complete project putting everything together
[32:00] We'll create a simple task manager application
[35:30] Finally let's discuss best practices and next steps
[38:00] Thank you for watching and happy coding
"""

print("Generating chapters for test transcript...")
print("=" * 80)

chapters = generate_chapters(test_transcript)

print("Generated Chapters:")
print("-" * 80)
print(chapters)
print("=" * 80)

# Interactive mode
print("\n\n🎯 Interactive Mode - Enter your own transcripts!")
print("Paste your transcript (or type 'quit' to exit)\n")

while True:
    print("Transcript:")
    lines = []
    print("(Press Ctrl+D or Ctrl+Z when done, or type 'quit' to exit)")
    
    try:
        while True:
            line = input()
            if line.strip().lower() in ['quit', 'exit', 'q']:
                print("\nGoodbye!")
                exit(0)
            lines.append(line)
    except EOFError:
        pass
    
    transcript = '\n'.join(lines).strip()
    
    if not transcript:
        continue
    
    print("\n⏳ Generating chapters...")
    result = generate_chapters(transcript)
    
    print("\n✅ Generated Chapters:")
    print("-" * 80)
    print(result)
    print("=" * 80)
    print()
