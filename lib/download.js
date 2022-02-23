'use strict';

// 依存パッケージ
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs-extra');
const log4js = require('log4js');
const path = require('path');
const sanitize = require('sanitize-filename');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ポストのダウンロード処理
exports.dlPosts = async (searchWord) => {
  // 初期化
  log4js.configure('./config/download-log-config.json');
  const logger = log4js.getLogger('system');

  // インスタンス化
  const browser = await puppeteer.launch({
    //headless: false
  });
  const page = await browser.newPage();

  // ホームに移動
  await page.goto('https://ecchi.iwara.tv/');
  await page.waitForSelector('.r18-continue')

  // 警告画面でボタン押下
  await page.click('.r18-continue');
  await page.waitForSelector('.btn-sm')

  // ログイン画面に移動
  await page.click('.btn-sm');
  await page.waitForSelector('#edit-name');
  await page.waitForSelector('#edit-pass');

  // ログイン
  await page.type('#edit-name','nagisame');
  await page.type('#edit-pass','M@jimu$ume7');
  await page.click('#edit-submit');
  await page.waitForSelector('.search-link');

  let pageNum = 0;

  page_loop:
  while (true) {
    // n ページ目の検索を実行
    await page.goto('https://ecchi.iwara.tv/search?query=' + searchWord + '&f[0]=type:video&page='
      + pageNum);

    const searchRes = await page.$$eval('.title > a', hrefs => hrefs.map((a) => {return a.href}));

    // 続行条件のチェック
    if (searchRes.length === 0) {
      break page_loop;
    }

    // ページ内の検索結果でループ
    for (const postUrl of searchRes) {
      try {
        logger.debug('url: ' + postUrl);

        await page.goto(postUrl);
        await page.waitForFunction('document.querySelectorAll("#download-button, .request-friend").length');

        const privateNum = await page.$$eval('.request-friend', i => {return i.length});
        if (privateNum > 0) {
          await page.goBack();
          await page.waitForSelector('.search-link');
          continue;
        }

        await page.click('#download-button');
        await page.waitForSelector('.list-unstyled > li > a');

        const resolutions = await page.$$eval('.list-unstyled > li > a',
                              resolutions => resolutions.map((a) => {return a.href}));
        const fileUrl = resolutions[0];
        const dlOptions = {
          method: 'GET',
          url: fileUrl,
          encoding: null,
          responseType: 'arraybuffer'
        };

        const postId = postUrl.split("/").pop();
        const filePath = path.join(searchWord, postId + '.mp4');
        if (fs.existsSync(filePath)) {
          // do nothing
        } else {
          logger.debug('file: ' + fileUrl);
          fs.outputFileSync(filePath, (await axios.request(dlOptions)).data);
        }
      } catch(err) {
        // do nothing
        logger.error(err);
      }

      await page.goBack();
      await page.waitForSelector('.search-link');
    }

    // ページ数を加算
    pageNum++;
  }

  await browser.close();
}

// Wait 処理
const waitTimer = (quePoll) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, quePoll * 1000);
  });
};

const queryString = process.argv[2];
console.log(queryString);
exports.dlPosts(queryString);
