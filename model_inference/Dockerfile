FROM python:3.12-slim

WORKDIR /app

# Install system dependency required by LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages (binary wheels only)
RUN pip install --no-cache-dir --only-binary :all: \
    numpy pandas scikit-learn xgboost lightgbm catboost joblib

COPY stacking_pipeline.pkl .
COPY predict.py .

CMD ["python", "predict.py"]