from flask import Flask
from flask_restx import Resource, Api, fields, reqparse
import requests
import anthropic
from dotenv import load_dotenv
import re
import os
import openai
import spacy
from spacy import displacy
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import redis
import json


load_dotenv()

redis_client = redis.Redis(host=os.getenv('REDIS_HOST'))
nlp = spacy.load('fr_core_news_lg')

jde_classes = [
    "Rachat / Cession",
    "Levée de fonds",
    "Nouvelle implantation",
    "Changement de Dirigeant",
    "Procédure de sauvegarde",
    "Fermeture de site",
    "Création d’emploi / recrutement",
    "Extension géographique",
    "Investissement",
    "Nouvelle activité / produit",
    "Projet d’acquisition"
]
zeste_config = {
    'classes': ['rachat', 'bienfaisance', 'implantation', 'passation', 'banqueroute', 'fermeture', 'recrutement', 'territoire', 'investissement', 'innovation', 'acquisition'],
    'threshold': 0.11, # float or None
    'topk': 3, # int or None
}

app = Flask(__name__)
api = Api(app)

PredictRequest = reqparse.RequestParser()
PredictRequest.add_argument('method', choices=['bert', 'claude-v1', 'gpt-4', 'zeste'], required=True)
PredictRequest.add_argument('url', type=str, location='form')
Prediction = api.model('Prediction', {
    'label': fields.String,
    'score': fields.Float,
})
PredictResponse = api.model('PredictResponse', {
    'predictions': fields.List(fields.Nested(Prediction)),
})

EntitiesRequest = reqparse.RequestParser()
EntitiesRequest.add_argument('url', type=str, location='form')
NamedEntity = api.model('NamedEntity', {
    'label': fields.String,
    'type': fields.String,
})
EntitiesResponse = api.model('EntitiesResponse', {
    'html': fields.String,
    'entities': fields.List(fields.Nested(NamedEntity)),
})

def get_text_from_url(url):
    cached_text = redis_client.get(f'texts|{url}')
    if cached_text is not None:
        print(f'[TEXT][CACHE] {url}')
        return cached_text.decode('utf-8', 'ignore')

    print(f'[TEXT][QUERY] {url}')
    parsed_url = urlparse(url)
    if parsed_url.netloc != 'www.lejournaldesentreprises.com':
        raise ValueError('Invalid url')
    res = requests.get(url, params={'_format': 'json'})
    data = res.json()
    texts = []
    if 'body' in data and len(data['body']) > 0 and 'value' in data['body'][0]:
        html = data['body'][0]['value']
        soup = BeautifulSoup(html, 'html.parser')
        text = soup.get_text()
        texts.append(text)
    if 'field_abstract' in data and len(data['field_abstract']) > 0 and 'value' in data['field_abstract'][0]:
        texts.append(data['field_abstract']['value'])
    final_text = '. '.join(texts).decode('utf-8', 'ignore')

    redis_client.set(f'texts|{url}', final_text)
    return final_text


def get_zeste_predictions(text):
    assert(len(zeste_config['classes']) == len(jde_classes))
    res = requests.post('https://zeste.tools.eurecom.fr/api/predict',
        headers={
            'accept': 'application/json',
        },
        json={
            "labels": ["rachat", "bienfaisance", "implantation", "passation", "banqueroute", "fermeture", "recrutement", "territoire", "investissement", "innovation", "acquisition"],
            "language": "fr",
            "text": text,
            "explain": False,
            "highlights": False
        }
    )
    json = res.json()
    predictions = []
    for i, result in enumerate(json['results']):
        # Check if i if above topk
        if zeste_config['topk'] is not None and i >= zeste_config['topk']:
            break
        # Check if result['score'] is above threshold
        if zeste_config['threshold'] is not None and result['score'] < zeste_config['threshold']:
            continue
        # Get index of class from zeste_classes based on result['label']
        index = zeste_config['classes'].index(result['label'])
        # Get corresponding class from jde_classes
        jde_class = jde_classes[index]
        predictions.append({
            'label': jde_class,
            'score': result['score']
        })
    return predictions


def get_claude_predictions(text):
    claude_classes = [
        'Rachat / Cession',
        'Levée de fonds',
        'Nouvelle implantation',
        'Changement de Dirigeant',
        'Procédure de sauvegarde',
        'Fermeture de site',
        "Création d'emploi / recrutement",
        'Extension géographique',
        'Investissement',
        'Nouvelle activité / produit',
        "Projet d'acquisition"
    ]
    assert(len(jde_classes) == len(claude_classes))
    prompt_classes = '\n'.join([f'{i+1}. {x}' for i, x in enumerate(claude_classes)])

    CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
    client = anthropic.Client(CLAUDE_API_KEY)

    text = text.replace('\n', ' ')[0:28000-500]
    prompt=f"""{anthropic.HUMAN_PROMPT}Human: Texte à classifier: {text}.
Veuillez retourner jusqu'à 3 numéros de catégories séparés par une virgule, parmi les options suivantes, uniquement si explicitement décrites.
{prompt_classes}
Choix:{anthropic.AI_PROMPT}"""
    resp = client.completion(
        prompt=prompt,
        stop_sequences=[anthropic.HUMAN_PROMPT],
        model="claude-v1.3",
        max_tokens_to_sample=8,
    )
    predictions = []
    numbers = re.findall(r'\d+', resp['completion'])
    numbers_list = [int(num) for num in numbers]
    for num in numbers_list:
        if num >= 1 and num <= len(jde_classes):
            predictions.append({
                'label': jde_classes[num - 1],
                'score': 1.0
            })
    return predictions


def get_gpt_predictions(text):
    gpt_classes = [
        "Rachat / Cession",
        "Levée de fonds",
        "Nouvelle implantation",
        "Changement de Dirigeant",
        "Procédure de sauvegarde",
        "Fermeture de site",
        "Création d'emploi / recrutement",
        "Extension géographique",
        "Investissement",
        "Nouvelle activité / produit",
        "Projet d'acquisition"
    ]
    assert(len(jde_classes) == len(gpt_classes))
    prompt_classes = '\n'.join([f'{i+1}. {x}' for i, x in enumerate(gpt_classes)])

    openai.api_key = os.getenv('OPENAI_API_KEY')

    text = text.replace('\n', ' ')[0:8000-500]
    prompt=f"""Texte à classifier: {text}.
Veuillez retourner jusqu'à 3 numéros de catégories séparés par une virgule, parmi les options suivantes, uniquement si explicitement décrites.
{prompt_classes}
Choix:"""

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            { "role": "user", "content": prompt },
        ]
    )

    predictions = []
    numbers = re.findall(r'\d+', response['choices'][0]['message']['content'])
    numbers_list = [int(num) for num in numbers]
    for num in numbers_list:
        if num >= 1 and num <= len(jde_classes):
            predictions.append({
                'label': jde_classes[num - 1],
                'score': 1.0
            })

    return predictions


def get_bert_predictions(text):
    res = requests.post(os.getenv('BERT_API_URL') + '/predict',
        headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        data={
            "text": text,
        }
    )
    data = res.json()
    return data['predictions']


@api.route('/status')
class Status(Resource):
    @api.response(200, 'Success')
    def get(self):
        return 'OK'


@api.route('/predict')
class Predict(Resource):
    @api.expect(PredictRequest)
    @api.marshal_with(PredictResponse)
    @api.response(200, 'Success')
    @api.response(501, 'Prediction method not implemented')
    def post(self):
        args = PredictRequest.parse_args()
        method = args['method']
        url = args['url']

        cached_predictions = redis_client.get(f'predictions|{method}|{url}')
        if cached_predictions is not None:
            print(f'[PREDICT][CACHE] {method} {url}')
            return { 'predictions': json.loads(cached_predictions) }

        print(f'[PREDICT][QUERY] {method} {url}')
        text = get_text_from_url(url)
        if method == 'zeste':
            predictions = get_zeste_predictions(text)
        elif method == 'claude-v1':
            predictions = get_claude_predictions(text)
        elif method == 'gpt-4':
            predictions = get_gpt_predictions(text)
        elif method == 'bert':
            predictions = get_bert_predictions(text)
        else:
            return 'Prediction method not implemented', 501

        redis_client.set(f'predictions|{method}|{url}', json.dumps(predictions))
        return { 'predictions': predictions }


@api.route('/entities')
class Predict(Resource):
    @api.expect(EntitiesRequest)
    @api.marshal_with(EntitiesResponse)
    @api.response(200, 'Success')
    def post(self):
        args = EntitiesRequest.parse_args()
        url = args['url']

        cached_entities = redis_client.get(f'entities|{url}')
        if cached_entities is not None:
            print(f'[ENTITIES][CACHE] {url}')
            return json.loads(cached_entities)

        print(f'[ENTITIES][QUERY] {url}')
        text = get_text_from_url(url)
        doc = nlp(text)
        html = displacy.render(doc, style='ent', page=False, jupyter=False, options={'ents': ['ORG', 'LOC', 'PER']})
        html = html.replace('</br>', ' ')
        entities = [(e.text, e.label_) for e in doc.ents]

        response = { 'html': html, 'entities': entities }
        redis_client.set(f'entities|{url}', json.dumps(response))
        return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=os.getenv('PORT', '5000'))