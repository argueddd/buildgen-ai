import subprocess
from pathlib import Path
from tqdm import tqdm

input_dir = Path("./data/JG/")
output_dir = Path("./data/output/")
mineru_exe = "mineru"

# 获取所有 PDF 文件
pdf_files = list(input_dir.glob("*.pdf"))
total = len(pdf_files)

print(f"共找到 {total} 个 PDF 文件，开始处理...\n")

for pdf_path in tqdm(pdf_files, desc="Processing PDFs", ncols=80):
    print(f"\n🔹 正在处理: {pdf_path.name}")
    cmd = [
        mineru_exe,
        "-p", str(pdf_path),
        "-o", str(output_dir)
    ]
    try:
        subprocess.run(cmd, check=True)  # 输出会直接在终端显示
        print(f"✅ 处理完成: {pdf_path.name}")
    except subprocess.CalledProcessError:
        print(f"❌ 处理失败: {pdf_path.name}")