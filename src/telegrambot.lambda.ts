/* eslint-disable no-console */
import { DynamoDB } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import { CoinGeckoClient } from 'coingecko-api-v3';
import got from 'got';
const apiKey = process.env.API_KEY;

enum CoinGeckoClientIds {
  GST_SOL ='green-satoshi-token',
  GST_BSC ='green-satoshi-token-bsc'
}

interface OnEventResponse {
  status: string;
}

interface User {
  chat_id: string;
  chat_name: string;
  enable: boolean;
}

const telegramClient = got.extend({
  prefixUrl: `https://api.telegram.org/bot${apiKey}/`,
});

export async function sendMessage(chatId: string, message: string, encodeURIed?: boolean) {
  var res: any;
  console.log(`send message to ${chatId}...`);
  if (encodeURIed) {
    res = await telegramClient.get(
      'sendMessage', {
        searchParams: { chat_id: chatId, text: encodeURI(message) },
      }).json();
  } else {
    res = await telegramClient.get(
      'sendMessage', {
        searchParams: { chat_id: chatId, text: message },
      }).json();
  }


  console.log(`finsh message to ${chatId}...`);
  console.info('res: ', res);
}

export async function CoinGeckoApi(ids: string) {
  const client = new CoinGeckoClient({
    timeout: 10000,
    autoRetry: true,
  });
  const price_usd = await client.simplePrice({ ids: ids, vs_currencies: 'usd' });
  const price_twd = await client.simplePrice({ ids: ids, vs_currencies: 'twd' });

  return { usd: price_usd[ids].usd, twd: price_twd[ids].twd };
}

export async function addUser(table: string, user: User) {
  const dynamoDB = new DynamoDB({ apiVersion: '2017-10-17' });
  const data = await dynamoDB.scan({
    TableName: table,
    Select: 'COUNT',
    ScanFilter: {
      chat_id: {
        AttributeValueList: [
          {
            S: user.chat_id,
          },
        ],
        ComparisonOperator: 'EQ',
      },
    },
  }).promise();

  console.log(data);
  if (data.Count === 1) {
    console.log('User existed');
    return 'User existed';
  } else {
    try {
      await dynamoDB.putItem({
        TableName: table,
        Item: {
          chat_id: {
            S: user.chat_id,
          },
          chat_name: {
            S: `${user.chat_name}`,
          },
          enable: {
            BOOL: true,
          },
        },
      }).promise();
      return 'Enabled Notify...';
    } catch (error) {
      console.warn(error);
      return 'Enabled Notify Failed, Please try again later...';
    }
  }

}

export async function removeUser(table: string, user: User) {
  var client = new DynamoDB({ apiVersion: '2017-10-17' });
  const users = await client.scan({
    TableName: table,
    Select: 'ALL_ATTRIBUTES',
    ScanFilter: {
      chat_id: {
        AttributeValueList: [
          {
            S: user.chat_id,
          },
        ],
        ComparisonOperator: 'EQ',
      },
    },
  }).promise();
  console.info(users);
  if (users.Count === 1) {
    try {

      var params = {
        Key: {
          chat_id: user.chat_id,
        },
        TableName: table,
      };
      var docClient = new DynamoDB.DocumentClient({ apiVersion: '2017-10-17' });
      docClient.delete(params, function (err, data) {
        if (err) {
          console.error('Error', err);
          throw new Error(`${err}`);
        } else {
          console.log('Success', data);
        }
      });
      return 'Stoped Notify';
    } catch (error) {
      console.warn(error);
      return 'Stop Notify Failed, Please try again later...';
    }
  } else {
    console.log('You did not enabled notify');
    return 'You did not enabled notify';
  }
}

export async function handler(event: any): Promise<OnEventResponse> {

  const table = `${process.env.TABLE}`;
  let chat_id = '';
  let chat_name = '';
  let text = '';
  let source = '';
  var item;
  var jsonBodyEvent;
  try {
    jsonBodyEvent = JSON.parse(event.body);
  } catch (error) {
  }

  try {
    chat_id = `${jsonBodyEvent.message.chat.id}`;
    text = jsonBodyEvent.message.text;
    chat_name = `${jsonBodyEvent.message.chat.username}`;

  } catch (error) {
  }
  try {
    source = event.source;
    item = event.CronJob
  } catch (error) {
  }

  try {
    console.log(`Chat_id: ${chat_id}, Text: ${text}`);
    console.log(`Source: ${source}`);

    if (text === 'start') {
      console.log('start notify');
      const res = await addUser(table, { chat_id, chat_name, enable: true });
      console.log(res);
      await sendMessage(chat_id, res);
      return { status: '200' };
    } else if (text === 'stop') {
      console.log('stop notify');
      const res = await removeUser(table, { chat_id, chat_name, enable: true });
      await sendMessage(chat_id, res);
      return { status: '200' };
    } else if (source === 'aws.statemachine') {
      console.log('events notify');
      const GST_BSC = await CoinGeckoApi(CoinGeckoClientIds.GST_BSC);
      const GST_SOL = await CoinGeckoApi(CoinGeckoClientIds.GST_SOL);
      const price = `
BSC Token Now Price
GST_BSC: USD: ${JSON.stringify(GST_BSC.usd) } TWD: ${JSON.stringify(GST_BSC.twd) }
GST_SOL: USD: ${JSON.stringify(GST_SOL.usd) } TWD: ${JSON.stringify(GST_SOL.twd) }
Times: ${JSON.stringify(Number(GST_BSC.usd) / Number(GST_SOL.usd))}
`;
      console.log(price);
      try {
        console.log('start to send message...');
        console.log('items: ', item.chat_id.S);
        await sendMessage(item.chat_id.S, price);
        console.log(`finsh to send message to ${item.chat_id.S}...`);
      } catch (error) {
        console.error(error);
      }

      return { status: '200' };
    }

  } catch (error) {
    console.error(error);
  }

  return {
    status: '200',
  };

};