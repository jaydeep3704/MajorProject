# YouTube Transcript to Chapter Converter - Fine-tuning Dataset

This dataset contains YouTube video transcripts and their corresponding chapters from FreeCodeCamp videos.

## Dataset Structure

Each training example contains:
- `instruction`: Task description for the model
- `input`: Full video transcript with timestamps
- `output`: Chapter titles with timestamps

## Files

- `training_data.jsonl`: Main training data in JSONL format
- `train.jsonl`: Training split (80%)
- `validation.jsonl`: Validation split (20%)
- `training_data_alpaca.json`: Alpaca format
- `training_data_full.json`: Complete dataset with metadata
- `dataset_metadata.csv`: Summary statistics
- `axolotl_config.yml`: Configuration for Axolotl framework
- `train_lora.py`: Simple training script

## Training on RTX 3050

Your RTX 3050 (4-8GB VRAM) can handle LoRA fine-tuning with these optimizations:

### Requirements

```bash
pip install transformers peft bitsandbytes accelerate datasets torch
```

### Option 1: Using the Provided Script

```bash
python train_lora.py
```

### Option 2: Using Axolotl

```bash
# Install Axolotl
git clone https://github.com/OpenAccess-AI-Collective/axolotl
cd axolotl
pip install -e .

# Copy your data and config
cp path/to/dataset/* axolotl/

# Start training
accelerate launch -m axolotl.cli.train axolotl_config.yml
```

### Option 3: Using Ollama (for inference after training)

After training, you can convert your model to GGUF format and use with Ollama:

```bash
# Convert to GGUF
python llama.cpp/convert.py ./youtube-chapter-model --outfile model.gguf

# Create Modelfile
FROM ./model.gguf
PARAMETER temperature 0.7
PARAMETER top_p 0.9

# Import to Ollama
ollama create youtube-chapter-converter -f Modelfile
```

## Recommended Models for RTX 3050

1. **Mistral-7B** (Recommended)
   - Best performance for size
   - ~4GB VRAM with 4-bit quantization

2. **Llama-3-8B**
   - Excellent instruction following
   - ~4GB VRAM with 4-bit quantization

3. **Phi-3-mini**
   - Smaller, faster
   - ~2GB VRAM with 4-bit quantization

## Training Parameters (Optimized for RTX 3050)

```python
- Batch size: 1
- Gradient accumulation: 8 steps
- Learning rate: 2e-4
- LoRA rank: 16
- LoRA alpha: 32
- 4-bit quantization: Enabled
- Gradient checkpointing: Enabled
- FP16 training: Enabled
```

## Expected Training Time

- ~2-4 hours for 50 examples on RTX 3050
- ~4-8 hours for 100 examples

## Using the Trained Model

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "mistralai/Mistral-7B-v0.1",
    load_in_4bit=True,
    device_map="auto"
)

# Load LoRA adapters
model = PeftModel.from_pretrained(base_model, "./youtube-chapter-model")
tokenizer = AutoTokenizer.from_pretrained("./youtube-chapter-model")

# Generate chapters
prompt = f"""### Instruction:
Convert the following YouTube video transcript into chapters with timestamps.

### Input:
{your_transcript}

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_new_tokens=500)
chapters = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(chapters)
```

## Tips for Better Results

1. **More data**: Try to get 200-500 examples for better performance
2. **Diverse videos**: Include various video lengths and topics
3. **Quality filtering**: Remove low-quality transcripts
4. **Augmentation**: Create variations of existing examples
5. **Validation**: Always check model outputs on validation set

## Troubleshooting

### Out of Memory Errors
- Reduce batch size to 1
- Increase gradient accumulation steps
- Enable gradient checkpointing
- Use 4-bit quantization
- Reduce sequence length

### Slow Training
- Use FP16 training
- Enable gradient checkpointing
- Use paged optimizers (paged_adamw_8bit)
- Reduce LoRA rank if needed

## License

Dataset is for educational purposes. Respect YouTube's Terms of Service and video creators' rights.
