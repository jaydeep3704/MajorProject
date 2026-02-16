#!/usr/bin/env python3
"""
LoRA Fine-tuning with Phi-3-Mini for RTX 3050 4GB
Perfect for chapter generation with minimal memory usage

Model: microsoft/Phi-3-mini-4k-instruct (3.8B parameters)
VRAM Usage: ~2.5GB with 4-bit quantization
RAM Usage: ~4GB
"""

import torch
import gc
import os
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset

# ============================================================================
# CONFIGURATION - PHI-3-MINI OPTIMIZED FOR 4GB
# ============================================================================

MODEL_NAME = "microsoft/Phi-3-mini-4k-instruct"
DATASET_PATH = "./dataset/train.jsonl"
OUTPUT_DIR = "./youtube-chapter-phi3"

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("=" * 80)
print("Phi-3-Mini Training for RTX 3050 4GB")
print("=" * 80)
print(f"Model: {MODEL_NAME}")
print(f"Expected VRAM: ~2.5GB")
print(f"Expected RAM: ~4GB")
print("=" * 80 + "\n")

# Clear memory
torch.cuda.empty_cache()
gc.collect()

# Memory optimization
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:128"

# ============================================================================
# LOAD MODEL
# ============================================================================

print("[1/6] Loading Phi-3-Mini with 4-bit quantization...")

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
    low_cpu_mem_usage=True,
    torch_dtype=torch.float16,
    attn_implementation="eager"  # Use eager attention for stability
)

print("✓ Model loaded")

# ============================================================================
# LOAD TOKENIZER
# ============================================================================

print("\n[2/6] Loading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

print("✓ Tokenizer loaded")

# ============================================================================
# PREPARE FOR TRAINING
# ============================================================================

print("\n[3/6] Adding LoRA adapters...")

model = prepare_model_for_kbit_training(model)

# LoRA config - optimized for small model
lora_config = LoraConfig(
    r=16,  # Can use higher rank with smaller model
    lora_alpha=32,
    target_modules=["qkv_proj", "o_proj", "gate_up_proj", "down_proj"],  # Phi-3 specific
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ============================================================================
# LOAD DATASET
# ============================================================================

print("\n[4/6] Loading dataset...")

dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
print(f"✓ Loaded {len(dataset)} examples")

def format_prompt(example):
    # Phi-3 uses specific prompt format
    input_text = example['input'][:4000] if len(example['input']) > 4000 else example['input']
    
    prompt = f"""<|system|>
You are a helpful AI assistant that converts YouTube video transcripts into chapters with timestamps.<|end|>
<|user|>
{example['instruction']}

Transcript:
{input_text}<|end|>
<|assistant|>
{example['output']}<|end|>"""
    
    return {"text": prompt}

dataset = dataset.map(format_prompt)

def tokenize_function(examples):
    return tokenizer(
        examples["text"],
        truncation=True,
        max_length=2048,  # Phi-3 supports 4k, but 2k is safer for training
        padding="max_length"
    )

print("\n[5/6] Tokenizing dataset...")

tokenized_dataset = dataset.map(
    tokenize_function,
    batched=True,
    remove_columns=dataset.column_names,
    desc="Tokenizing"
)

print("✓ Tokenization complete")

# ============================================================================
# TRAINING
# ============================================================================

print("\n[6/6] Setting up training...")

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=2,  # Can use 2 with smaller model
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    weight_decay=0.01,
    warmup_steps=50,
    max_grad_norm=0.3,
    fp16=True,
    gradient_checkpointing=True,
    optim="paged_adamw_8bit",
    logging_steps=5,
    save_steps=50,
    save_total_limit=2,
    lr_scheduler_type="cosine",
    report_to="none",
    dataloader_pin_memory=False,
    dataloader_num_workers=0,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
)

print("\n" + "=" * 80)
print("STARTING TRAINING")
print("=" * 80)
print(f"Batch size: 2 (effective: 16)")
print(f"Epochs: 3")
print(f"Expected time: 2-6 hours")
print("=" * 80 + "\n")

try:
    trainer.train()
    
    print("\n" + "=" * 80)
    print("TRAINING COMPLETE!")
    print("=" * 80)
    
    print("\nSaving model...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"✓ Model saved to: {OUTPUT_DIR}")
    print("\n✓ Training finished successfully!")
    
except RuntimeError as e:
    if "out of memory" in str(e):
        print("\n" + "=" * 80)
        print("OUT OF MEMORY ERROR!")
        print("=" * 80)
        print("\nTry:")
        print("1. Reduce batch size to 1")
        print("2. Reduce max_length to 1024")
        print("3. Increase gradient_accumulation_steps to 16")
        print("=" * 80)
        torch.cuda.empty_cache()
    raise

except KeyboardInterrupt:
    print("\n\nTraining interrupted!")
