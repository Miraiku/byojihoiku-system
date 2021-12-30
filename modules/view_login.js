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
      .then(token => {
        let updated_token = updateUserToken(token, user)
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
  return await psgl.sqlToPostgre(
    `INSERT INTO public."Admin" ("Name", "Password", "Token") VALUES ( '${user.Name}','${user.Password}', '${user.Token}') RETURNING "ID", "Name", "CreatedAt", "Token"`)
  .then((data) => data[0])
}

const updateUserToken = async (token, user) => {
  return await psgl.sqlToPostgre(`UPDATE public."Admin" SET "Token" = '${token}' WHERE "Name" = '${user.Name}' RETURNING "ID", "Name", "Token" `)
    .then((data) => data[0])
}


const authenticate = (userReq) => {
  findByToken(userReq.token)
    .then((user) => {
      console.log(userReq.token)
      console.log(userReq.name)
      console.log(user)
      if (user.Name == userReq.name) {
        return true
      } else {
        return false
      }
    })
}

const findByToken = async (token) => {
  return await psgl.sqlToPostgre(`SELECT * FROM public."Admin" WHERE "Token" = '${token}'`)
    .then((data) => data[0])
}
const signup = (request, response) => {
  let isLogined = false
  if(request.session.token && req.session.name){
    const userSession = {token: req.session.token, name: req.session.name}
    console.log(userSession)
    isLogined = login.authenticate(userSession)
  }
  if (!isLogined) {
    request.redirect('/')
  }
  const user = request.body
  hashPassword(user.Password)
    .then((hashedPassword) => {
      delete user.Password
      user.Password = hashedPassword
    })
    .then(() => createToken())
    .then(token => user.Token = token)
    .then(() => createUser(user))
    .then(user => {
      delete user.Password
      response.status(201).json({ user })
    })
    .catch((err) => console.error(err))
}

module.exports = {
  signin, signup, authenticate
}