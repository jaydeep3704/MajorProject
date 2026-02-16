#!/usr/bin/env python3
"""
Inference Script for Fine-tuned Phi-3-Mini
Test your trained model on new transcripts
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

# Configuration
BASE_MODEL = "microsoft/Phi-3-mini-4k-instruct"
LORA_WEIGHTS = "./youtube-chapter-phi3"  # Path to your trained LoRA adapters

print("Loading model...")

# Load with 4-bit for inference
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16
)

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# Load LoRA adapters
model = PeftModel.from_pretrained(base_model, LORA_WEIGHTS)
model.eval()

# Load tokenizer
tokenizer = AutoTokenizer.from_pretrained(LORA_WEIGHTS, trust_remote_code=True)

print("✓ Model loaded successfully!\n")

# Test transcript
test_transcript = """
[00:00] Welcome to this comprehensive tutorial on Python programming
[00:30] In this video we'll cover the basics of Python syntax
[02:15] First let's talk about variables and data types
[05:45] Now we'll move on to control flow statements like if else and loops
[10:30] Functions are a crucial part of Python let's learn how to define them
[15:00] Object oriented programming is next on our agenda
[20:15] Finally we'll build a complete project putting everything together
[25:30] Thank you for watching don't forget to subscribe
"""

def generate_chapters(transcript, max_new_tokens=300):
    """Generate chapters from transcript."""
    
    prompt = f"""<|system|>
You are a helpful AI assistant that converts YouTube video transcripts into chapters with timestamps.<|end|>
<|user|>
Convert the following YouTube video transcript into chapters with timestamps. Each chapter should have a timestamp in MM:SS or HH:MM:SS format followed by a descriptive title.

Transcript:
{transcript}<|end|>
<|assistant|>
"""
    
    inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1,
            pad_token_id=tokenizer.eos_token_id
        )
    
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Extract only the assistant's response
    if "<|assistant|>" in result:
        result = result.split("<|assistant|>")[-1].strip()
    
    return result

# Generate chapters
print("Generating chapters...")
print("=" * 80)

chapters = generate_chapters(test_transcript)

print("Generated Chapters:")
print("-" * 80)
print(chapters)
print("=" * 80)

# Interactive mode
print("\n\nEnter your own transcript (or 'quit' to exit):")
while True:
    print("\nTranscript:")
    transcript = input().strip()
    
    if transcript.lower() in ['quit', 'exit', 'q']:
        break
    
    if not transcript:
        continue
    
    print("\nGenerating chapters...")
    result = generate_chapters(transcript)
    print("\nChapters:")
    print(result)
    print()
