# async-webpage-scraper
An asynchronous, queue driven, web page scraper

### About
This project was designed to scrape data for a machine learning trainer.  However, it can be repurposed for other things
and may serve as a good start for other use cases.

### Setup
- `npm install`
- Add domains, category mapping to `domain_category_mapping.csv`
- Set concurrency limit with in `index.js` with PQueue `concurrency`(default is 32)

### Run
`node index.js`
