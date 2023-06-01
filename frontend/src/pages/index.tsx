import { Lato } from 'next/font/google'
import { useState } from 'react'
import { ArticleResult } from './api/article'
import { allowedMethods } from './api/predict'

import styles from './index.module.css'

const methodsOptions: { [key: string]: any } = {
  bert: {
    name: 'Algorithme 1',
    color: 'bg-yellow-500',
  },
  'claude-v1': {
    name: 'Algorithme 2b',
    color: 'bg-cyan-500',
    hideScore: true,
  },
  'gpt-4': {
    name: 'Algorithme 2a',
    color: 'bg-emerald-500',
    hideScore: true,
  },
  zeste: {
    name: 'Algorithme 3',
    color: 'bg-lime-500',
  },
}

const generateLoadingLines = () => {
  const loadingLines = []
  function randomValue() {
    const values = [
      'w-24',
      'w-28',
      'w-32',
      'w-36',
      'w-40',
      'w-44',
      'w-48',
      'w-52',
      'w-56',
      'w-60',
      'w-64',
      'w-72',
      'w-80',
      'w-96',
      'w-full',
    ]
    const randomIndex = Math.floor(Math.random() * values.length)
    return values[randomIndex]
  }
  loadingLines.push(
    <>
      <div className="grid grid-cols-6">
        <div className="h-2 bg-slate-700 rounded col-span-5"></div>
      </div>
      <div className="grid grid-cols-6">
        <div className="h-2 bg-slate-700 rounded col-span-1"></div>
      </div>
    </>
  )
  for (let i = 0; i < 10; i += 1) {
    loadingLines.push(
      <div className="flex items-center w-full space-x-2" key={i}>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-700 ${randomValue()}`}
        ></div>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-600 ${randomValue()}`}
        ></div>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-600 ${randomValue()}`}
        ></div>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-700 ${randomValue()}`}
        ></div>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-600 ${randomValue()}`}
        ></div>
        <div
          className={`h-2.5 bg-gray-200 rounded-full dark:bg-gray-600 ${randomValue()}`}
        ></div>
      </div>
    )
  }
  return loadingLines
}

const lato = Lato({ subsets: ['latin'], weight: '400' })

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ArticleResult | null>()
  const [predictions, setPredictions] = useState<any>({})
  const [themes, setThemes] = useState<string[]>([])
  const [url, setUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    predict(url)
  }

  const predict = async (url: string) => {
    setUrl(url)
    setIsLoading(true)
    setResult(null)
    setHtml(null)
    setPredictions({})
    setThemes([])
    setError(null)

    const resArticle = await (
      await fetch('/api/article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })
    ).json()

    if (resArticle.error) {
      setError(resArticle.error)
      return
    }

    setResult(resArticle)
    setHtml(resArticle.html)
    setIsLoading(false)

    setPredictions(
      allowedMethods.reduce((acc: any, method: string) => {
        acc[method] = { loading: true }
        return acc
      }, {})
    )

    await fetch('/api/entities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((res) => {
        setHtml(res.html)
      })
      .catch(() => {})

    await fetch('/api/themes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((res) => {
        setThemes(res.themes)
      })
      .catch(() => {})

    for (const method of allowedMethods) {
      fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, method }),
      })
        .then((res) => res.json())
        .then((res) => {
          setPredictions((predictions: any) => ({
            ...predictions,
            [method]: res,
          }))
        })
        .catch(() => {
          setPredictions((predictions: any) => ({
            ...predictions,
            [method]: {
              method,
              error: 'An error occured while fetching the predictions.',
            },
          }))
        })
    }
  }

  const date = new Date(result?.article?.created?.[0].value)
    .toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    .toLocaleLowerCase()

  const renderPredictionLabels = (results: any) => {
    if (results.loading) {
      return (
        <div style={{ flex: 1, minWidth: 250, maxWidth: 350 }}>
          <div className="animate-pulse">
            <div className="space-y-6 py-1">
              <div className="grid gap-2">
                <div
                  className="bg-slate-700 rounded-full col-span-1"
                  style={{ height: 36 }}
                ></div>
                <div
                  className="bg-slate-700 rounded-full col-span-1"
                  style={{ height: 36 }}
                ></div>
                <div
                  className="bg-slate-700 rounded-full col-span-1"
                  style={{ height: 36 }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    if (results.error) {
      return <>{results.error}</>
    }
    if (!results.predictions || results.predictions.length === 0) {
      return <>Aucune prédiction</>
    }
    return results.predictions.map((prediction: any, i: number) => (
      <span
        key={prediction.label}
        className={`px-4 py-2 font-semibold text-sm ${
          methodsOptions[results.method].color
        } text-white rounded-full shadow-sm`}
      >
        {prediction.label}{' '}
        {!methodsOptions[results.method].hideScore && (
          <sup>({prediction.score.toFixed(2)})</sup>
        )}
      </span>
    ))
  }

  return (
    <div className={lato.className}>
      <header className={`sticky top-0 z-50 ${styles.header}`}>
        <div
          className={styles.menu}
          onClick={() => {
            setResult(undefined)
            setUrl('')
          }}
        >
          <span className={styles.menu_button}>
            <span></span>
          </span>
          <span className={`hidden md:inline ${styles.menu_title}`}>Menu</span>
        </div>
        <div className={styles.header_logo}>
          <img
            alt="Le Journal des Entreprises"
            title=""
            src="https://www.lejournaldesentreprises.com/themes/custom/jde/img/logo.svg"
          />
        </div>
        <div className={styles.header_buttons}>
          <div className={styles.user_button}>
            <div className={styles.user_button_avatar}></div>
            <span className="hidden md:inline">Anne-Sophie Hervé</span>
          </div>
        </div>
      </header>
      <main className={`relative flex items-center ${styles.main}`}>
        {result !== undefined ? (
          <div className="w-full flex flex-col items-center pt-10">
            <form method="post" className="w-9/12" onSubmit={onSubmit}>
              <div>
                <label
                  htmlFor="first_name"
                  className="block mb-2 text-xl font-medium text-gray-900"
                >
                  URL de l&apos;article du Journal des Entreprises :
                </label>
                <div className="flex items-center">
                  <input
                    type="url"
                    name="url"
                    value={url}
                    onChange={(ev) => setUrl(ev.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-xl rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                    placeholder="https://www.lejournaldesentreprises.com/france/article/..."
                    required
                    disabled={isLoading}
                  ></input>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="ml-3 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none inline-flex items-center font-semibold leading-6 shadow text-white bg-red-500 hover:bg-red-400 active:bg-red-600"
                  >
                    {isLoading && (
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    Predict
                  </button>
                </div>
              </div>
            </form>
            <div className="w-9/12 my-8">
              {isLoading && (
                <div className="w-full mx-auto">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-6 py-1 max-w-full">
                      {generateLoadingLines()}
                    </div>
                  </div>
                </div>
              )}
              {error && error}
              {result && (
                <>
                  <div className="flex flex-wrap gap-4">
                    {allowedMethods.map((method) => {
                      // Check if predictions has method as a key
                      if (!predictions[method]) {
                        return undefined
                      }
                      const results = predictions[method]
                      return (
                        <div className="flex flex-col" key={method}>
                          <div>
                            <span className="font-semibold">
                              {methodsOptions[method].name}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {renderPredictionLabels(results)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <hr className="my-6" />
                  <article className="prose lg:prose-xl max-w-none">
                    <h1 className="mb-4 lg:mb-4">
                      {result.article.title[0].value}
                    </h1>
                    {result.article.field_auteur_libre?.[0] && (
                      <div className="mb-4 text-slate-500">
                        Par {result.article.field_auteur_libre[0].value}
                        {result.article.created && <>, le {date}</>}
                      </div>
                    )}
                    {!result.article.field_auteur_libre?.[0] &&
                      result.article.created?.[0] && (
                        <div className="mb-4 text-slate-500">{date}</div>
                      )}
                    {themes.length > 0 && (
                      <div className="mb-4 flex gap-2">
                        <span className="font-semibold">
                          Thème{themes.length === 1 ? '' : 's'}:
                        </span>
                        {themes.map((theme) => (
                          <div
                            key={theme}
                            className="px-4 py-2 font-semibold text-sm bg-slate-400 text-white rounded-full shadow-sm"
                          >
                            {theme}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-8">
                      {html ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: html,
                          }}
                        ></div>
                      ) : (
                        <>
                          {result.article.field_abstract?.[0] && (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: result.article.field_abstract[0].value,
                              }}
                            ></div>
                          )}
                          <div
                            dangerouslySetInnerHTML={{
                              __html: result.article.body?.[0].value,
                            }}
                          ></div>
                        </>
                      )}
                    </div>
                  </article>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center py-8">
            <form
              method="post"
              className="w-3/4 flex flex-col"
              onSubmit={onSubmit}
            >
              <label
                htmlFor="first_name"
                className="block mb-2 text-xl font-medium text-gray-900"
              >
                URL de l&apos;article du Journal des Entreprises :
              </label>
              <div className="flex items-center">
                <input
                  type="url"
                  name="url"
                  value={url}
                  onChange={(ev) => setUrl(ev.target.value)}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-xl rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  placeholder="https://www.lejournaldesentreprises.com/france/article/..."
                  required
                  disabled={isLoading}
                ></input>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ml-3 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none inline-flex items-center font-semibold leading-6 shadow text-white bg-red-500 hover:bg-red-400 active:bg-red-600"
                >
                  {isLoading && (
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                  Predict
                </button>
              </div>
            </form>
            <div className="flex flex-col w-3/4 ml-6 mt-4 text-gray-500">
              <div className="mb-2">Ou essayer avec un exemple :</div>
              <div className="flex flex-col lg:flex-row gap-4">
                <div
                  className="max-w-sm rounded overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => {
                    predict(
                      'https://www.lejournaldesentreprises.com/hauts-de-france/breve/le-groupe-socomore-rachete-mader-aero-204794'
                    )
                  }}
                >
                  <div className="px-6 py-4">
                    <div className="font-bold text-gray-700 text-xl truncate">
                      Le groupe Socomore rachète Mäder Aero
                    </div>
                    <p className="text-gray-600 text-sm mb-2">30 avril 2019</p>
                    <p className="text-gray-700 text-base">
                      Le groupe breton Socomore (CA 2018 : 65 M€) a finalisé
                      l&apos;acquisition de 100 % de Mäder Aero, l&apos;activité
                      aéronautique et défense du groupe…
                    </p>
                  </div>
                </div>
                <div
                  className="max-w-sm rounded overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => {
                    predict(
                      'https://www.lejournaldesentreprises.com/auvergne-rhone-alpes/breve/la-region-aura-alloue-plus-de-40-millions-deuros-de-credits-europeens-2060546'
                    )
                  }}
                >
                  <div className="px-6 py-4">
                    <div className="font-bold text-gray-700 text-xl truncate">
                      La région AURA alloue plus de 40 millions d’euros de
                      crédits européens
                    </div>
                    <p className="text-gray-600 text-sm mb-2">05 mai 2023</p>
                    <p className="text-gray-700 text-base">
                      La région Auvergne-Rhône-Alpes qui gère plus de 1,5
                      milliard d’euros de crédits européens pour les 5
                      prochaines années a attribué le…
                    </p>
                  </div>
                </div>
                <div
                  className="max-w-sm rounded overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => {
                    predict(
                      'https://www.lejournaldesentreprises.com/ille-et-vilaine/breve/le-roy-logistique-agrandit-sa-surface-logistique-en-gironde-2060446'
                    )
                  }}
                >
                  <div className="px-6 py-4">
                    <div className="font-bold text-gray-700 text-xl truncate">
                      Le Roy Logistique agrandit sa surface logistique en
                      Gironde
                    </div>
                    <p className="text-gray-600 text-sm mb-2">04 mai 2023</p>
                    <p className="text-gray-700 text-base">
                      La société Le Roy Logistique, spécialisée dans la
                      logistique du transport (viticole, agroalimentaire, BTP ou
                      e-commerce) dont le siège est implanté à…
                    </p>
                  </div>
                </div>
                <div
                  className="max-w-sm rounded overflow-hidden shadow-lg cursor-pointer"
                  onClick={() => {
                    predict(
                      'https://www.lejournaldesentreprises.com/region-sud/breve/david-gesbert-est-le-nouveau-directeur-deurecom-1763860'
                    )
                  }}
                >
                  <div className="px-6 py-4">
                    <div className="font-bold text-gray-700 text-xl truncate">
                      David Gesbert est le nouveau directeur d&apos;Eurecom
                    </div>
                    <p className="text-gray-600 text-sm mb-2">
                      05 janvier 2022
                    </p>
                    <p className="text-gray-700 text-base">
                      David Gesbert a été nommé directeur d’Eurecom, en
                      remplacement d’Ulrich Finger qui prend sa retraite après
                      avoir occupé ce poste pendant plus de vingt…
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
