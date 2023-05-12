import type { NextApiRequest, NextApiResponse } from 'next'
import { convert } from 'html-to-text'
import { APIError } from '@/types'

export type EntitiesResult = {
  entities: any
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EntitiesResult | APIError>
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

  const articleAbstract = convert(data.field_abstract?.[0].value)
  const articleText = convert(data.body?.[0].value)

  const apiUrl = process.env.API_URL as string
  const resPredict = await (
    await fetch(`${apiUrl}/entities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: [articleAbstract, articleText].filter((x) => x).join('. '),
      }),
    })
  ).json()

  res.status(200).json(resPredict)
}
