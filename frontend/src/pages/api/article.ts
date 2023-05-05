import { APIError } from '@/types'
import type { NextApiRequest, NextApiResponse } from 'next'
import { convert } from 'html-to-text'

export type ArticleResult = {
  text: string
  article: any
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleResult | APIError>
) {
  const urlParam = req.body.url
  if (!urlParam) {
    return res.status(400).json({ error: 'Missing url' })
  }

  const url = new URL(urlParam)
  if (url.hostname !== 'www.lejournaldesentreprises.com') {
    return res.status(400).json({ error: 'Invalid url' })
  }

  url.searchParams.set('_format', 'json')

  const data = await (await fetch(url)).json()
  const articleText = convert(data.body[0].value)

  const response: ArticleResult = {
    text: articleText,
    article: data,
  }

  res.status(200).json(response)
}
