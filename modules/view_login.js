const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const psgl = require('./db_postgre')

const signin = (request, response) => {
  try {
    const userReq = request.body
    let user
    let token_created
    findUser(userReq)
      .then(foundUser => {
        user = foundUser
        return checkPassword(userReq.Password, foundUser)
      })
      .then((res) => createToken())
      .then(async token => {
        let updated_token = await updateUserToken(token, user)
        token_created = updated_token.Token
      })
      .then(() => {
        delete user.Password
        request.session.token = token_created
        request.session.name = userReq.Name
        response.status(200).send()
      })
      .catch((err) => {
        console.error("ERROR scope@signin： "+err);
        response.status(406).send('エラーが発生しました')
      })
  } catch (error) {
    console.error("ERROR @signin： "+error);
    response.status(406).send('エラーが発生しました')
  }
}

const findUser = async (userReq) => {
  return await psgl.sqlToPostgre(`SELECT * FROM public."Admin" WHERE "Name" = '${userReq.Name}';`)
    .then((data) => data[0])
}

const checkPassword = (reqPassword, foundUser) => {
  return new Promise((resolve, reject) =>
    bcrypt.compare(reqPassword, foundUser.Password, (err, response) => {
        if (err) {
          reject(err)
        }else if (response) {
          resolve(response)
        } else {
          reject(new Error('Passwords do not match.'))
        }
    })
  )
}

// crypto ships with node - we're leveraging it to create a random, secure token
const createToken = () => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, data) => {
      err ? reject(err) : resolve(data.toString('base64'))
    })
  })
}

const hashPassword = (password) => {
  return new Promise((resolve, reject) =>
    bcrypt.hash(password, 10, (err, hash) => {
      err ? reject(err) : resolve(hash)
    })
  )
}

const createUser = async (user) => {
  if(await alreadyRegisterd(user.Name)){
    return false
  }else{
    return await psgl.sqlToPostgre(
      `INSERT INTO public."Admin" ("Name", "Password", "Token") VALUES ( '${user.Name}','${user.Password}', '${user.Token}') RETURNING "ID", "Name", "CreatedAt", "Token"`)
    .then((data) => data[0])
  }
}

const updateUserToken = async (token, user) => {
  return await psgl.sqlToPostgre(`UPDATE public."Admin" SET "Token" = '${token}' WHERE "Name" = '${user.Name}' RETURNING "ID", "Name", "Token" `)
    .then((data) => data[0])
}


const authenticate = async (userReq) => {
  let auth = false
  await findByToken(userReq.token)
    .then((user) => {
      if (user.Name == userReq.name) {
        auth = true
      } else {
        auth = false
      }
    })
  return auth
}

const alreadyRegisterd = async (name) => {
  let membered = await psgl.sqlToPostgre(`SELECT COUNT("ID") FROM public."Admin" WHERE "Name" = '${name}'`)
    .then((data) => data[0])
  if(Number(membered.count) > 0){
    return true
  }else{
    return false
  }
}
const findByToken = async (token) => {
  return await psgl.sqlToPostgre(`SELECT * FROM public."Admin" WHERE "Token" = '${token}'`)
    .then((data) => data[0])
}
const signup = (request, response) => {
  /* ログイン確認 */
  let isLogined = false
  if(request.session.token && request.session.name){
    const userSession = {token: request.session.token, name: request.session.name}
    isLogined = authenticate(userSession)
  }
  if (!isLogined) {
    response.status(404).send()
    /* ログイン確認終了 */
  }else{
    const user = request.body
    let created
    hashPassword(user.Password)
      .then((hashedPassword) => {
        delete user.Password
        user.Password = hashedPassword
      })
      .then(() => createToken())
      .then(token => user.Token = token)
      .then(async () => { 
        created = await createUser(user)
        if(created){
          delete created.Password
          response.status(201).json({ user })
        }else{
          response.status(406).send()
        }
      })
      .catch((err) => {
        response.status(503).send()
        console.error(err)}
      )
  }
}

module.exports = {
  signin, signup, authenticate
}