from flask import Flask
from flask_restx import Resource, Api, fields, reqparse
import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch


jde_classes = ["Rachat / Cession", "Levée de fonds", "Nouvelle implantation", "Changement de Dirigeant", "Procédure de sauvegarde", "Fermeture de site", "Création d’emploi / recrutement", "Extension géographique", "Investissement.1", "Nouvelle activité / produit", "Projet d’acquisition"]

bert_tokenizer_name = 'bert-base-multilingual-cased'
print(f'Loading tokenizer {bert_tokenizer_name}')
bert_tokenizer = AutoTokenizer.from_pretrained(bert_tokenizer_name)
print('Finished loading tokenizer')
bert_models = {}
for cls in jde_classes:
    model_path = os.path.join('bert-models', cls.replace('/', '-'))
    print(f'Loading model {model_path}')
    bert_models[cls] = AutoModelForSequenceClassification.from_pretrained(model_path, num_labels=2)
print('Finished loading models')

app = Flask(__name__)
api = Api(app)

PredictRequest = reqparse.RequestParser()
PredictRequest.add_argument('text', type=str, location='form')

Prediction = api.model('Prediction', {
    'label': fields.String,
    'score': fields.Float,
})

PredictResponse = api.model('PredictResponse', {
    'predictions': fields.List(fields.Nested(Prediction)),
})

def get_bert_predictions(text):
    predictions = []
    inputs = bert_tokenizer([text], padding=True, truncation=True, return_tensors="pt")
    for index, model_name in enumerate(bert_models.keys()):
        outputs = bert_models[model_name](**inputs)
        y_pred = torch.argmax(outputs.logits, dim=1).tolist()
        if y_pred[0] == 1:
            predictions.append({
                'label': jde_classes[index],
                'score': y_pred[0]
            })
    return predictions


@api.route('/predict')
class Predict(Resource):
    @api.expect(PredictRequest)
    @api.marshal_with(PredictResponse)
    @api.response(200, 'Success')
    def post(self):
        args = PredictRequest.parse_args()
        text = args['text']
        predictions = get_bert_predictions(text)
        return { 'predictions': predictions }

if __name__ == '__main__':
    app.run(host='0.0.0.0')