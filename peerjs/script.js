'use strict'

const canvasSize = {
  x: 600, y: 400
}

var user = {
  peer: undefined,
  x: undefined,
  y: undefined,
  color: undefined,

  getProperties() {
    return {
      id: this.peer?.id,
      x: this.x,
      y: this.y,
      color: this.color
    }
  },

  setColor(seed) {
    this.color = getColorFromStringWithTransparency(seed)
  }
}

var listUsers = []
var flow


const createPeer = async () => {
  user.peer = new Peer()
  user.x = Math.round(Math.random() * canvasSize.x)
  user.y = Math.round(Math.random() * canvasSize.y)

  user.peer.on('open', async (id) => {
	   console.log('My peer ID is: ' + id)
     document.getElementById("peerId").innerHTML = id
     user.setColor(id)
     listUsers.push(user.getProperties())
  })

  user.peer.on('connection', async (connexion) => {
    flow = connexion

    connexion.on('open', async () => {
      console.log('peer connection - conn open')
      sendData()
    })

    connexion.on('data', async (data) => {
      // console.log('peer connection - conn data', data)
      dataReceived(data)
    })
  })
}

const joinRoom = async () => {
  const roomId = await getRoomToJoin()
  const connexion = user.peer.connect(roomId)
  flow = connexion

  connexion.on('open', async () => {
    console.log('joinRoom - conn open')
    sendData()
  })

  connexion.on('data', async (data) => {
    // console.log('joinRoom - conn data', data)
    dataReceived(data)
  })
}

const dataReceived = async (data) => {
  const usersData = JSON.parse(data)
  usersData.forEach((userData, i) => {
    const index = listUsers.findIndex(u => u.id === userData.id)
    if(index > -1) {
      if(listUsers[index].id !== user.peer.id) {
        listUsers[index] = userData
      }
    } else {
      listUsers.push(userData)
    }
  })
}

const sendData = async () => {
  if(!flow) return

  flow.send(JSON.stringify(listUsers))
}

const copyPeerId = async () => {
  if(!user.peer?.id) return

  navigator.clipboard.writeText(user.peer.id)

  document.getElementById("copyPeerIdButton").innerHTML = 'Copied !'
  setTimeout(() => document.getElementById("copyPeerIdButton").innerHTML = 'Copy', 3000)
}

const getRoomToJoin = async () => {
  return document.getElementById("roomToJoinInputId").value
}

const updateUser = async (event) => {
  if(!canvas) return
  const mouse = getMousePos(canvas, event)
  user.x = mouse.x
  user.y = mouse.y
  const index = listUsers.findIndex(u => u.id === user.peer.id)
  listUsers[index] = user.getProperties()
  sendData()
}

(async () => {
  createPeer()

  canvasInitialization()
})()
