# jde-predict

## Docker

```bash
docker-compose up
```

## API

### Prerequisites

1. Python >= 3.9

### Development

```bash
python app.py
```

### Production

```bash
python -m gunicorn -w 1 app:app
```


## Frontend

### Prerequisites

1. Node.js >= 10

### Development

First, run the development server:

```bash
cd frontend/
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Production

```bash
npm ci
npm start
```
