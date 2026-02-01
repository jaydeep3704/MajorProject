#!/usr/bin/env python3
"""
LoRA Fine-tuning Script for RTX 3050 4GB
HEAVILY OPTIMIZED FOR 4GB VRAM

Usage:
    python train_lora_4gb.py
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
# CONFIGURATION - OPTIMIZED FOR RTX 3050 4GB
# ============================================================================

MODEL_NAME = "mistralai/Mistral-7B-v0.1"
DATASET_PATH = "./dataset/train.jsonl"
OUTPUT_DIR = "./youtube-chapter-model"

# Create output directory
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================================
# MEMORY OPTIMIZATION - CRITICAL FOR 4GB
# ============================================================================

print("=" * 80)
print("RTX 3050 4GB - Memory Optimized Training")
print("=" * 80)

# Clear GPU memory
torch.cuda.empty_cache()
gc.collect()

# Set environment variables for memory optimization
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:128"

# ============================================================================
# LOAD MODEL WITH 4-BIT QUANTIZATION
# ============================================================================

print("\n[1/6] Loading model with 4-bit quantization...")

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
    torch_dtype=torch.float16
)

print("✓ Model loaded successfully")

# ============================================================================
# LOAD TOKENIZER
# ============================================================================

print("\n[2/6] Loading tokenizer...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

print("✓ Tokenizer loaded")

# ============================================================================
# PREPARE MODEL FOR TRAINING
# ============================================================================

print("\n[3/6] Preparing model for k-bit training...")

model = prepare_model_for_kbit_training(model)

# LoRA configuration - REDUCED for 4GB
lora_config = LoraConfig(
    r=8,  # LoRA rank (reduced from 16)
    lora_alpha=16,  # LoRA alpha (reduced from 32)
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)

print("\nTrainable parameters:")
model.print_trainable_parameters()

# ============================================================================
# LOAD AND PREPARE DATASET
# ============================================================================

print("\n[4/6] Loading dataset...")

dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

print(f"✓ Loaded {len(dataset)} examples")

def format_prompt(example):
    # Truncate input to save memory
    input_text = example['input'][:3000] if len(example['input']) > 3000 else example['input']
    
    prompt = f"""### Instruction:
{example['instruction']}

### Input:
{input_text}

### Response:
{example['output']}"""
    return {"text": prompt}

dataset = dataset.map(format_prompt)

def tokenize_function(examples):
    return tokenizer(
        examples["text"],
        truncation=True,
        max_length=1024,  # REDUCED from 2048 for 4GB
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
# TRAINING ARGUMENTS - AGGRESSIVE OPTIMIZATION FOR 4GB
# ============================================================================

print("\n[6/6] Setting up training...")

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    
    # Training parameters
    num_train_epochs=3,
    per_device_train_batch_size=1,  # MUST be 1 for 4GB
    gradient_accumulation_steps=16,  # Effective batch size = 16
    
    # Optimization
    learning_rate=2e-4,
    weight_decay=0.01,
    warmup_steps=20,
    max_grad_norm=0.3,
    
    # Memory optimizations
    fp16=True,
    gradient_checkpointing=True,
    optim="paged_adamw_8bit",
    
    # Logging and saving
    logging_steps=5,
    save_steps=50,
    save_total_limit=2,
    
    # Other settings
    lr_scheduler_type="cosine",
    report_to="none",
    dataloader_pin_memory=False,
    dataloader_num_workers=0,
    remove_unused_columns=True,
)

# ============================================================================
# CREATE TRAINER AND START TRAINING
# ============================================================================

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
)

print("\n" + "=" * 80)
print("STARTING TRAINING")
print("=" * 80)
print(f"Model: {MODEL_NAME}")
print(f"Dataset: {len(dataset)} examples")
print(f"Batch size: 1 (effective: 16 with gradient accumulation)")
print(f"Epochs: 3")
print(f"Expected time: 4-10 hours")
print("\nTips:")
print("- Monitor GPU temperature")
print("- Ensure adequate cooling")
print("- Don't run other GPU applications")
print("=" * 80 + "\n")

try:
    trainer.train()
    
    print("\n" + "=" * 80)
    print("TRAINING COMPLETE!")
    print("=" * 80)
    
    # Save model
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
        print("\nYour GPU ran out of memory. Try these solutions:\n")
        print("1. Reduce max_length to 512:")
        print("   Change: max_length=1024 → max_length=512")
        print("\n2. Increase gradient accumulation:")
        print("   Change: gradient_accumulation_steps=16 → 32")
        print("\n3. Reduce LoRA rank:")
        print("   Change: r=8 → r=4")
        print("\n4. Close other applications using GPU")
        print("\n5. Restart computer to clear GPU memory")
        print("\n6. Reduce dataset size (use fewer examples)")
        print("=" * 80)
        
        # Clear memory
        torch.cuda.empty_cache()
        gc.collect()
    raise

except KeyboardInterrupt:
    print("\n\nTraining interrupted by user!")
    print("Partial model may be saved in checkpoints.")
