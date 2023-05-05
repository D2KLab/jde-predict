FROM python:3.11-slim

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app
WORKDIR /app/

ENV PYTHONPATH=/app

EXPOSE 80

CMD ["gunicorn", "--timeout", "120", "--workers", "4", "--worker-class", "gevent", "--bind", "0.0.0.0:8000", "app:app"]