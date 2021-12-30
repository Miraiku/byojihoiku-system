const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const psgl = require('./db_postgre')
const e = require('connect-flash')
const { off } = require('process')
const { all } = require('./line_receiver')
const login = require('./view_login')

//https://gist.github.com/laurenfazah/f9343ae8577999d301334fc68179b485

const signin = (request, response) => {
  try {
    const userReq = request.body
    let user
    findUser(userReq)
      .then(foundUser => {
        user = foundUser
        return checkPassword(userReq.Password, foundUser)
      })
      .then((res) => createToken())
      .then(token => updateUserToken(token, user))
      .then(() => {
        delete user.Password
        response.redirect('/home')
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
  findByToken(userReq.Token)
    .then((user) => {
      if (user.Name == userReq.Name) {
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
  signin, signup
}