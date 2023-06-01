from flask import Flask
from flask_restx import Resource, Api, fields, reqparse
import os
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    pipeline,
)
import torch
from flair.data import Sentence
from flair.models import SequenceTagger
import spacy
from spacy import displacy
import math


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
    "Projet d’acquisition",
]

# BERT models
bert_models = {}
bert_tokenizer_name = 'bert-base-multilingual-cased'
print(f'Loading prediction tokenizer {bert_tokenizer_name}')
bert_tokenizer = AutoTokenizer.from_pretrained(bert_tokenizer_name)
print('Finished loading prediciton tokenizer')
for cls in jde_classes:
    model_path = os.path.join('bert-models', cls.replace('/', '-'))
    print(f'Loading prediction model {model_path}')
    bert_models[cls] = AutoModelForSequenceClassification.from_pretrained(model_path, num_labels=2)
print('Finished loading prediction models')

# Camembert NER
camembert_tokenizer = AutoTokenizer.from_pretrained(
    "Jean-Baptiste/camembert-ner"
)
camembert_model = AutoModelForTokenClassification.from_pretrained(
    "Jean-Baptiste/camembert-ner"
)
camembert_nlp = pipeline(
    "ner",
    model=camembert_model,
    tokenizer=camembert_tokenizer,
    aggregation_strategy="simple",
)

# Flair NER
flair_tagger = SequenceTagger.load("flair/ner-french")

# spaCy NER
spacy_nlp = spacy.load('fr_core_news_lg')


# Do a majority vote to figure out which label to keep for each entity
# If there is no majority, keep the first label
def majority_vote(all_entities):
    entities = {}
    for i, ner in enumerate(all_entities):
        for entity in ner:
            text = entity["text"]
            label = entity["label"]
            entities.setdefault(text, {}).setdefault(
                label, {"votes": 0, "voters": []}
            )
            if i not in entities[text][label]["voters"]:
                entities[text][label]["votes"] += 1
                entities[text][label]["voters"].append(i)

    majority = {}
    filtered_entities = {
        key: value
        for key, value in entities.items()
        if any(val["votes"] >= math.ceil(len(all_entities) / 2) for val in value.values())
    }
    filtered_entities = {
        entity: {
            entity_type: votes_info["votes"]
            for entity_type, votes_info in data.items()
        }
        for entity, data in filtered_entities.items()
    }

    for text in filtered_entities:
        majority[text] = max(
            filtered_entities[text], key=lambda x: filtered_entities[text][x]
        )

    return majority


# Web server
app = Flask(__name__)
api = Api(app)

PredictRequest = reqparse.RequestParser()
PredictRequest.add_argument("text", type=str, location="form")
Prediction = api.model(
    "Prediction",
    {
        "label": fields.String,
        "score": fields.Float,
    },
)
PredictResponse = api.model(
    "PredictResponse",
    {
        "predictions": fields.List(fields.Nested(Prediction)),
    },
)

NERRequest = reqparse.RequestParser()
NERRequest.add_argument("text", type=str, location="form")
NERResponse = api.model(
    "NERResponse",
    {
        "html": fields.String,
        "entities": fields.Raw,
        "all_entities": fields.Raw,
    },
)


def get_bert_predictions(text):
    predictions = []
    inputs = bert_tokenizer(
        [text], padding=True, truncation=True, return_tensors="pt"
    )
    for index, model_name in enumerate(bert_models.keys()):
        outputs = bert_models[model_name](**inputs)
        y_pred = torch.argmax(outputs.logits, dim=1).tolist()
        if y_pred[0] == 1:
            predictions.append(
                {"label": jde_classes[index], "score": y_pred[0]}
            )
    return predictions


def extract_entities(text):
    entities = {}

    camembert_entities = camembert_nlp(text)
    entities['camembert'] = list(map(lambda x: {
        "text": x['word'],
        "label": x['entity_group'],
        "score": float(x['score']),
        "start_position": int(x['start']),
        "end_position": int(x['end']),
    }, camembert_entities))

    flair_sentence = Sentence(text, use_tokenizer=True)
    flair_tagger.predict(flair_sentence)
    entities['flair'] = []
    for entity in flair_sentence.get_spans('ner'):
        entities['flair'].append({
            "text": entity.text,
            "label": entity.tag,
            "score": float(entity.score),
            "start_position": int(entity.start_position),
            "end_position": int(entity.end_position),
        })

    entities['spacy'] = []
    doc = spacy_nlp(text)
    for ent in doc.ents:
        entities['spacy'].append({
            "text": ent.text,
            "label": ent.label_,
            "start_position": int(ent.start_char),
            "end_position": int(ent.end_char),
        })

    filtered_entities = majority_vote(entities.values())

    dic_ents = {
        "text": text,
        "ents": [],
        "title": None,
    }
    for text in filtered_entities.keys():
        # Get start and end position from spaCy or Flair
        for entity in entities['spacy']:
            if entity['text'] == text:
                dic_ents["ents"].append({
                    "start": entity['start_position'],
                    "end": entity['end_position'],
                    "label": filtered_entities[text],
                })
        for entity in entities['flair']:
            if entity['text'] == text:
                # Check if the entity is already in the list at the same start,end,label
                already_in = False
                for ent in dic_ents['ents']:
                    if ent['start'] == entity['start_position'] and ent['end'] == entity['end_position'] and ent['label'] == filtered_entities[text]:
                        already_in = True
                if not already_in:
                    dic_ents["ents"].append({
                        "start": entity['start_position'],
                        "end": entity['end_position'],
                        "label": filtered_entities[text],
                    })

    return dic_ents


@api.route("/status")
class Status(Resource):
    @api.response(200, "Success")
    def get(self):
        return "OK"


@api.route("/predict")
class Predict(Resource):
    @api.expect(PredictRequest)
    @api.marshal_with(PredictResponse)
    @api.response(200, "Success")
    def post(self):
        args = PredictRequest.parse_args()
        text = args["text"]
        predictions = get_bert_predictions(text)
        return {"predictions": predictions}


@api.route("/ner")
class Predict(Resource):
    @api.expect(NERRequest)
    @api.marshal_with(NERResponse)
    @api.response(200, "Success")
    def post(self):
        args = PredictRequest.parse_args()
        text = args["text"]

        dic_ents = extract_entities(text)
        html = displacy.render(dic_ents, manual=True, style='ent', page=False, jupyter=False, options={'ents': ['ORG', 'LOC', 'PER']})
        html = html.replace('</br>', ' ')

        return { 'html': html, 'entities': dic_ents }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=os.getenv("PORT", 5000))
