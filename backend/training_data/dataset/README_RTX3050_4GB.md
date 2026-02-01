# YouTube Chapter Converter - RTX 3050 4GB Setup Guide

## 🚀 Quick Start

### Step 1: Install Data Collection Packages

```bash
pip install -r requirements.txt
```

This installs only the packages needed for data collection:
- yt-dlp (for downloading video metadata)
- youtube-transcript-api (for fetching transcripts)
- pandas, tqdm (for data processing)

### Step 2: Prepare Dataset

Run the Jupyter notebook to collect data from FreeCodeCamp:

```bash
jupyter notebook youtube_chapter_dataset_preparation.ipynb
```

Or run all cells programmatically:
```bash
jupyter nbconvert --to notebook --execute youtube_chapter_dataset_preparation.ipynb
```

This will create a `dataset/` folder with training data.

### Step 3: Install Training Packages

After dataset preparation, install the training packages:

```bash
pip install torch>=2.1.0 transformers>=4.36.0 peft>=0.7.0 bitsandbytes>=0.41.0 accelerate>=0.25.0 datasets>=2.15.0
```

### Step 4: Start Training

```bash
python train_lora_4gb.py
```

Expected training time: **4-10 hours** depending on dataset size.

---

## ⚙️ RTX 3050 4GB Optimizations

Your RTX 3050 has **4GB VRAM**, which is challenging but workable with these optimizations:

### Memory Optimizations Used:
✅ **4-bit quantization** - Reduces model size by 75%  
✅ **LoRA rank 8** (instead of 16) - Fewer trainable parameters  
✅ **Batch size 1** - Minimum possible  
✅ **Gradient accumulation 16** - Simulates larger batches  
✅ **Max sequence length 1024** (instead of 2048) - Less memory per sample  
✅ **Gradient checkpointing** - Trades compute for memory  
✅ **8-bit optimizer** - Reduces optimizer memory  

### What to Expect:

| Metric | Value |
|--------|-------|
| **Peak VRAM Usage** | ~3.8 GB |
| **Training Speed** | ~30-60 seconds per step |
| **Total Training Time** | 4-10 hours (50-100 examples) |
| **Model Quality** | Good (slightly lower than 8GB version) |

---

## 🔧 Troubleshooting

### Out of Memory Error

If you get "CUDA out of memory" error:

**Option 1: Reduce sequence length**
```python
# In train_lora_4gb.py, line ~115
max_length=1024  →  max_length=512
```

**Option 2: Increase gradient accumulation**
```python
# In train_lora_4gb.py, line ~150
gradient_accumulation_steps=16  →  gradient_accumulation_steps=32
```

**Option 3: Reduce LoRA rank**
```python
# In train_lora_4gb.py, line ~75
r=8  →  r=4
```

**Option 4: Use smaller model**
```python
# In train_lora_4gb.py, line ~25
MODEL_NAME = "microsoft/phi-2"  # Only 2.7B parameters
```

**Option 5: Reduce dataset**
- Use only 30-50 training examples instead of 100

### Training is Very Slow

This is normal for 4GB VRAM. Each step takes 30-60 seconds because:
- Batch size is 1 (can't be increased)
- Gradient accumulation requires 16 forward passes
- Gradient checkpointing recomputes activations

**To speed up slightly:**
- Close all other applications
- Close browser tabs
- Disable Windows animations
- Ensure good GPU cooling

### GPU Temperature Too High

If GPU temperature exceeds 85°C:
- Improve case airflow
- Clean GPU fans
- Reduce room temperature
- Take breaks between training runs
- Consider undervolting GPU

---

## 📊 Understanding the Training Process

### What Happens During Training:

1. **Data Loading** (1-2 minutes)
   - Loads transcripts and chapters
   - Tokenizes text into numbers

2. **Model Loading** (2-3 minutes)
   - Downloads Mistral-7B (13.5 GB)
   - Applies 4-bit quantization (reduces to ~4 GB)
   - Adds LoRA adapters (~50 MB trainable)

3. **Training Loop** (4-10 hours)
   - Processes one example at a time
   - Accumulates gradients over 16 examples
   - Updates LoRA weights
   - Saves checkpoints every 50 steps

4. **Saving** (1 minute)
   - Saves final LoRA adapters (~100 MB)
   - Saves tokenizer config

### Training Progress:

```
Step 1/150 | Loss: 2.45 | 45s/step
Step 2/150 | Loss: 2.31 | 43s/step
...
Step 50/150 | Loss: 1.12 | 38s/step [Checkpoint saved]
...
Step 150/150 | Loss: 0.45 | 35s/step
Training complete!
```

Loss should decrease from ~2.5 to ~0.5 over training.

---

## 🎯 Using Your Trained Model

After training completes, you'll have a `youtube-chapter-model/` folder with your fine-tuned model.

### Test Your Model:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

# Load base model
base_model = AutoModelForCausalLM.from_pretrained(
    "mistralai/Mistral-7B-v0.1",
    load_in_4bit=True,
    device_map="auto"
)

# Load your LoRA adapters
model = PeftModel.from_pretrained(base_model, "./youtube-chapter-model")
tokenizer = AutoTokenizer.from_pretrained("./youtube-chapter-model")

# Test on new transcript
test_transcript = """
[00:00] Hello everyone, welcome to this tutorial
[01:30] First, we'll cover the basics
[05:00] Then we'll move to advanced topics
[10:30] Finally, we'll do a practical example
"""

prompt = f"""### Instruction:
Convert the following YouTube video transcript into chapters with timestamps.

### Input:
{test_transcript}

### Response:
"""

inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
outputs = model.generate(
    **inputs,
    max_new_tokens=200,
    temperature=0.7,
    do_sample=True
)

result = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(result)
```

Expected output:
```
00:00 - Introduction
01:30 - Basic Concepts
05:00 - Advanced Topics
10:30 - Practical Example
```

---

## 📈 Improving Model Performance

### Get Better Results:

1. **More Data** (most important!)
   - Aim for 200-500 examples instead of 100
   - Diverse video lengths and topics

2. **Better Quality Data**
   - Only use videos with clear, well-formatted chapters
   - Remove videos with auto-generated/poor chapters

3. **Longer Training**
   - Increase epochs from 3 to 5
   - Monitor validation loss to avoid overfitting

4. **Data Augmentation**
   - Create variations of existing examples
   - Paraphrase chapter titles
   - Add synthetic examples

### Advanced: Merge with Base Model

After training, you can merge LoRA weights into base model for faster inference:

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM

# Load and merge
base = AutoModelForCausalLM.from_pretrained("mistralai/Mistral-7B-v0.1")
model = PeftModel.from_pretrained(base, "./youtube-chapter-model")
merged_model = model.merge_and_unload()

# Save merged model
merged_model.save_pretrained("./merged-chapter-model")
```

---

## 💡 Alternative: Use Ollama (Easier for Inference)

If you just want to use the model (not train it), consider Ollama:

1. Convert to GGUF format
2. Use with Ollama for easy inference
3. No need for Python/PyTorch

See main README for Ollama instructions.

---

## 📞 Need Help?

Common issues:
- **CUDA not available**: Install CUDA toolkit and PyTorch with CUDA support
- **Model download fails**: Check internet connection, try different mirror
- **Import errors**: Reinstall packages with `pip install --upgrade --force-reinstall`
- **Slow training**: Normal for 4GB, be patient!

---

## 🎓 Learning Resources

- [PEFT Documentation](https://huggingface.co/docs/peft)
- [LoRA Paper](https://arxiv.org/abs/2106.09685)
- [Transformers Documentation](https://huggingface.co/docs/transformers)
- [BitsAndBytes Documentation](https://github.com/TimDettmers/bitsandbytes)

---

**Good luck with your training! 🚀**

Remember: 4GB is tight, but totally doable with the right optimizations!
