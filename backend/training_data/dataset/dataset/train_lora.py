#!/usr/bin/env python3
"""
Mistral-7B LoRA Fine-tuning
SAFE for RTX 3050 Laptop (4GB VRAM)
"""

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from datasets import load_dataset

# ======================
# CONFIG
# ======================
MODEL_NAME = "mistralai/Mistral-7B-v0.1"
DATASET_PATH = "./dataset/train.jsonl"
OUTPUT_DIR = "./youtube-chapter-model"

MAX_LENGTH = 768          # HARD LIMIT (do not increase)
EPOCHS = 3
BATCH_SIZE = 1
GRAD_ACCUM = 8

# ======================
# 4-bit Quantization
# ======================
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

# ======================
# Load Model
# ======================
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)

model.config.use_cache = False  # REQUIRED for gradient checkpointing

# ======================
# Tokenizer
# ======================
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

# ======================
# Prepare model
# ======================
model = prepare_model_for_kbit_training(model)

# ======================
# LoRA Config (SAFE)
# ======================
lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    target_modules=["q_proj", "v_proj"],  # DO NOT ADD MORE
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# ======================
# Dataset
# ======================
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

def format_prompt(example):
    return {
        "text": f"""### Instruction:
{example['instruction']}

### Input:
{example['input']}

### Response:
{example['output']}"""
    }

dataset = dataset.map(format_prompt)

def tokenize(example):
    return tokenizer(
        example["text"],
        truncation=True,
        max_length=MAX_LENGTH,
    )

tokenized_dataset = dataset.map(
    tokenize,
    remove_columns=dataset.column_names,
)

data_collator = DataCollatorForLanguageModeling(
    tokenizer=tokenizer,
    mlm=False,
)

# ======================
# Training Args
# ======================
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    learning_rate=2e-4,
    fp16=True,
    gradient_checkpointing=True,
    optim="paged_adamw_8bit",
    logging_steps=10,
    save_steps=200,
    save_total_limit=2,
    warmup_steps=50,
    report_to="none",
)

# ======================
# Trainer
# ======================
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_dataset,
    data_collator=data_collator,
)

# ======================
# Train
# ======================
print("🔥 Starting Mistral-7B LoRA training...")
trainer.train()

# ======================
# Save
# ======================
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)

print(f"✅ Training complete. Model saved to {OUTPUT_DIR}")
