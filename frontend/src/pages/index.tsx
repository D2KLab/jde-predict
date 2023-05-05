import { Lato } from 'next/font/google'
import { useEffect, useState } from 'react'
import { ArticleResult } from './api/article'
import { allowedMethods } from './api/predict'

import styles from './index.module.css'

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

const methodsColors: { [key: string]: string } = {
  bert: 'bg-yellow-500',
  'claude-v1': 'bg-cyan-500',
  'gpt-4': 'bg-emerald-500',
  zeste: 'bg-lime-500',
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPredictions, setLoadingPredictions] = useState(false)
  const [result, setResult] = useState<ArticleResult | null>()
  const [predictions, setPredictions] = useState<any>({})
  const [url, setUrl] = useState('')
  const [error, setError] = useState(null)

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    setIsLoading(true)
    setResult(null)
    setPredictions({})
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
    setIsLoading(false)

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
    }
  }

  const date = new Date(result?.article?.created?.[0].value)
    .toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    .toLocaleLowerCase()

  useEffect(() => {
    setLoadingPredictions(
      Object.keys(predictions).length !== allowedMethods.length
    )
  }, [predictions])

  return (
    <div className={lato.className}>
      <header className={`${styles.header}`}>
        <div className={styles.menu}>
          <span className={styles.menu_button}>
            <span></span>
          </span>
          <span className={`${styles.menu_title}`}>Menu</span>
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
            <span>Anne-Sophie Hervé</span>
          </div>
        </div>
      </header>
      <main className={styles.main}>
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
                    {predictions &&
                      Object.values(predictions).map((pred: any) => {
                        return (
                          <div className="mb-8 flex flex-col" key={pred.method}>
                            <div>
                              <span className="font-semibold uppercase ml-2">
                                {pred.method}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {pred.labels.length === 0 ? (
                                <>No predictions</>
                              ) : (
                                pred.labels.map((label: string, i: number) => (
                                  <span
                                    key={label}
                                    className={`px-4 py-2 font-semibold text-sm ${
                                      methodsColors[pred.method]
                                    } text-white rounded-full shadow-sm`}
                                  >
                                    {label}{' '}
                                    <sup>({pred.scores[i].toFixed(2)})</sup>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    {loadingPredictions && (
                      <div
                        className="mb-8"
                        style={{ flex: 1, minWidth: 150, maxWidth: 300 }}
                      >
                        <div className="animate-pulse">
                          <div className="space-y-6 py-1">
                            <div className="space-y-3">
                              <div className="grid gap-2">
                                <div className="h-2 bg-slate-700 rounded col-span-1"></div>
                              </div>
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
                      </div>
                    )}
                  </div>
                  <hr className="mb-6" />
                  <article className="prose lg:prose-xl max-w-none">
                    <h1 className="mb-4 lg:mb-4">
                      {result.article.title[0].value}
                    </h1>
                    {result.article.field_auteur_libre?.[0] && (
                      <div className="mb-8 text-slate-500">
                        Par {result.article.field_auteur_libre[0].value}
                        {result.article.created && <>, le {date}</>}
                      </div>
                    )}
                    {!result.article.field_auteur_libre?.[0] &&
                      result.article.created?.[0] && (
                        <div className="mb-8 text-slate-500">{date}</div>
                      )}
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
                  </article>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <form method="post" className={styles.form} onSubmit={onSubmit}>
              <div>
                <label
                  htmlFor="first_name"
                  className="block mb-2 text-xl font-medium text-gray-900"
                >
                  URL de l&apos;article du Journal des Entreprises :
                </label>
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
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="ml-auto mt-3 font-medium rounded-lg text-sm px-5 py-2.5 focus:outline-none inline-flex items-center font-semibold leading-6 shadow text-white bg-indigo-500 hover:bg-indigo-400"
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
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
