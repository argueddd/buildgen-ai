import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from backend.src.infrastructure.milvus_db import MilvusDbManager
from flask import send_from_directory

app = Flask(__name__)
CORS(app)  # 允许跨域访问前端 localhost:3000 请求


PDF_DIR = '../data/JG'  # 你存 PDF 的真实目录

@app.route('/pdfs/<path:filename>')
def serve_pdf(filename):
    file_path = os.path.join(PDF_DIR, filename)
    if not os.path.isfile(file_path):
        return jsonify({'error': '文件不存在'}), 404
    return send_from_directory(PDF_DIR, filename)


@app.route('/search', methods=['GET'])
def search_endpoint():
    print("hi, this is search endpoint")
    query = request.args.get('query')
    limit = int(request.args.get('limit', 5))

    if not query:
        return jsonify({"error": "缺少参数 query"}), 400

    manager = MilvusDbManager(collection_name="specs_architecture")
    results = manager.search(query_text=query, limit=limit)

    return jsonify({"results": results})

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=8010)