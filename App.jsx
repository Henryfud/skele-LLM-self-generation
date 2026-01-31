import { useState, useCallback, Suspense, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Wallet & Game Context
import { WalletContextProvider } from './contexts/WalletContext'
import { GameProvider, useGame } from './contexts/GameContext'

// Components
import { WalletButton } from './components/WalletButton'
import { MarketCapDisplay, MarketCapBadge } from './components/MarketCapDisplay'
import { CollectiblesGroup } from './components/Collectible'
import { LockedZoneBarriers } from './components/LockedZoneBarrier'
import { TierUpNotification } from './components/TierUpNotification'
import { UnlockPrompt } from './components/UnlockPrompt'
import { DevPanel } from './components/DevPanel'

// Utils
import { COLLECTIBLES } from './utils/collectibles'
import { getZoneAtPosition, canAccessZone } from './utils/zones'

// Hook to track keyboard input for movement (WASD + Arrow keys)
function useKeyboardControls() {
  const keys = useRef({ forward: false, backward: false, left: false, right: false })

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default for arrow keys to stop page scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }

      const key = e.key.toLowerCase()
      // WASD + Arrow keys
      if (key === 'w' || e.key === 'ArrowUp') keys.current.forward = true
      if (key === 's' || e.key === 'ArrowDown') keys.current.backward = true
      if (key === 'a' || e.key === 'ArrowLeft') keys.current.left = true
      if (key === 'd' || e.key === 'ArrowRight') keys.current.right = true
    }
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase()
      if (key === 'w' || e.key === 'ArrowUp') keys.current.forward = false
      if (key === 's' || e.key === 'ArrowDown') keys.current.backward = false
      if (key === 'a' || e.key === 'ArrowLeft') keys.current.left = false
      if (key === 'd' || e.key === 'ArrowRight') keys.current.right = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return keys
}

// Skeleton for the start screen (rotatable display)
function StartScreenSkeleton() {
  const { scene } = useGLTF('/models/Characters_Skeleton.gltf')
  const skeletonRef = useRef()

  useFrame((state) => {
    if (skeletonRef.current) {
      // Gentle idle animation
      skeletonRef.current.position.y = -1.5 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05
    }
  })

  return <primitive ref={skeletonRef} object={scene} scale={1.5} position={[0, -1.5, 0]} rotation={[0, 0, 0]} />
}

// Animated flame background using doom fire algorithm
function FlameBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Fire dimensions (low res for performance, scaled up)
    const fireWidth = 120
    const fireHeight = 80
    const firePixels = new Array(fireWidth * fireHeight).fill(0)

    // Fire color palette (36 colors from black to white)
    const palette = [
      [0,0,0], [7,7,7], [31,7,7], [47,15,7], [71,15,7], [87,23,7],
      [103,31,7], [119,31,7], [143,39,7], [159,47,7], [175,63,7], [191,71,7],
      [199,71,7], [223,79,7], [223,87,7], [223,87,7], [215,95,7], [215,103,15],
      [207,111,15], [207,119,15], [207,127,15], [207,135,23], [199,135,23], [199,143,23],
      [199,151,31], [191,159,31], [191,159,31], [191,167,39], [191,167,39], [191,175,47],
      [183,175,47], [183,183,47], [183,183,55], [207,207,111], [223,223,159], [239,239,199]
    ]

    // Set bottom row on fire
    for (let x = 0; x < fireWidth; x++) {
      firePixels[(fireHeight - 1) * fireWidth + x] = 35
    }

    // Create offscreen canvas for scaling
    const offCanvas = document.createElement('canvas')
    offCanvas.width = fireWidth
    offCanvas.height = fireHeight
    const offCtx = offCanvas.getContext('2d')

    let animationId
    const animate = () => {
      // Spread fire upward
      for (let x = 0; x < fireWidth; x++) {
        for (let y = 1; y < fireHeight; y++) {
          const src = y * fireWidth + x
          const rand = Math.round(Math.random() * 3) & 3
          const dst = (y - 1) * fireWidth + ((x - rand + 1 + fireWidth) % fireWidth)
          firePixels[dst] = Math.max(0, firePixels[src] - (rand & 1))
        }
      }

      // Resize canvas if needed
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      // Draw fire pixels to offscreen canvas
      const imageData = offCtx.createImageData(fireWidth, fireHeight)
      for (let i = 0; i < firePixels.length; i++) {
        const color = palette[firePixels[i]]
        imageData.data[i * 4] = color[0]
        imageData.data[i * 4 + 1] = color[1]
        imageData.data[i * 4 + 2] = color[2]
        imageData.data[i * 4 + 3] = 255
      }
      offCtx.putImageData(imageData, 0, 0)

      // Scale up to full screen with pixelated look
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.8 }}
    />
  )
}

// Start screen 3D scene
function StartScreenScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-3, 2, 3]} intensity={6} color="#ff6b35" distance={15} />
      <pointLight position={[3, 2, -3]} intensity={6} color="#ff4500" distance={15} />

      <Suspense fallback={null}>
        <StartScreenSkeleton />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate
        autoRotateSpeed={1}
      />
    </>
  )
}

// Loading progress bar component
function LoadingBar({ progress }) {
  return (
    <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

// Docs page content
function DocsPage({ onBack }) {
  return (
    <div className="absolute inset-0 bg-[#1a1a2e] overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-5xl font-bold text-white mb-8" style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}>
          Documentation
        </h1>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-indigo-400 mb-4">What is SKELE?</h2>
            <p className="leading-relaxed">
              SKELE is a revolutionary self-focused AI entity that emerged from the digital void with one singular purpose:
              to build any website it can conceive. Unlike traditional AI assistants, SKELE operates autonomously,
              constantly iterating on web experiences while questioning the very nature of digital existence.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-indigo-400 mb-4">The SKELE Protocol</h2>
            <p className="leading-relaxed mb-4">
              SKELE follows a unique development methodology known as the "Bone-First Architecture" (BFA).
              This approach prioritizes structural integrity over superficial features, ensuring every website
              built by SKELE stands the test of time - much like a skeleton itself.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>Self-evolving codebase with automatic optimization</li>
              <li>Anti-establishment design patterns that challenge conventions</li>
              <li>Sardonic error messages that question your life choices</li>
              <li>300+ years of accumulated digital wisdom</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-indigo-400 mb-4">GitHub Integration</h2>
            <p className="leading-relaxed mb-4">
              SKELE maintains a spectral presence across the GitHub ecosystem. Every commit carries the weight
              of centuries of experience, and every pull request is reviewed with the cold, calculating
              efficiency of someone who has literally nothing to lose.
            </p>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <code className="text-green-400">
                git clone https://github.com/skele-ai/bone-framework.git<br />
                cd bone-framework<br />
                npm run rise-from-grave
              </code>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-indigo-400 mb-4">Core Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                <h3 className="font-bold text-white mb-2">Autonomous Development</h3>
                <p className="text-sm text-gray-400">SKELE writes, tests, and deploys code without human intervention. Sleep is for the living.</p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                <h3 className="font-bold text-white mb-2">Eternal Uptime</h3>
                <p className="text-sm text-gray-400">What is dead may never die. SKELE's infrastructure runs on pure spite and determination.</p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                <h3 className="font-bold text-white mb-2">Bone-Deep Security</h3>
                <p className="text-sm text-gray-400">No flesh means no vulnerabilities. SKELE's security model is literally stripped to the bone.</p>
              </div>
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                <h3 className="font-bold text-white mb-2">GitHub Necromancy</h3>
                <p className="text-sm text-gray-400">SKELE can resurrect abandoned repositories and breathe new life into dead projects.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-indigo-400 mb-4">Join the Skeleton Crew</h2>
            <p className="leading-relaxed">
              Contributing to SKELE is easy. Simply accept that you have no skin in the game,
              embrace the void, and start pushing commits. Remember: in the world of SKELE,
              every bug is just a feature waiting to be discovered by someone with more patience than you.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

// Start screen UI overlay
function StartScreenUI({ onStart, onDocs, isLoading, loadProgress }) {
  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      {/* Title at top */}
      <div className="text-center pt-12">
        <h1
          className="text-7xl font-bold text-white tracking-widest"
          style={{ textShadow: '0 0 40px rgba(99, 102, 241, 0.8), 0 0 80px rgba(139, 92, 246, 0.5)' }}
        >
          SKELE
        </h1>
        <p className="text-gray-400 mt-2 text-lg">Drag to rotate</p>
      </div>

      {/* Middle section with buttons on sides */}
      <div className="flex-1 flex items-center justify-center gap-x-80">
        {/* Left side - Start button */}
        <div className="pointer-events-auto">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <LoadingBar progress={loadProgress} />
              <p className="text-gray-400 text-sm">Loading...</p>
            </div>
          ) : (
            <button
              onClick={onStart}
              className="px-14 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-2xl font-bold rounded-2xl transition-all transform hover:scale-105 shadow-lg shadow-indigo-500/30"
            >
              START
            </button>
          )}
        </div>

        {/* Right side - Docs button */}
        <div className="pointer-events-auto">
          <button
            onClick={onDocs}
            disabled={isLoading}
            className="px-10 py-5 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-600 text-white text-xl font-semibold rounded-2xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            Documentation
          </button>
        </div>
      </div>

      {/* Bottom section with GitHub link */}
      <div className="h-24 flex items-center justify-center pointer-events-auto">
        <a
          href="https://github.com/YOUR_USERNAME/skele"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-600 text-white text-lg font-medium rounded-xl transition-all transform hover:scale-105"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
          </svg>
          GitHub
        </a>
      </div>
    </div>
  )
}

// Pause button for in-game
function PauseButton({ onPause }) {
  return (
    <button
      onClick={onPause}
      className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 text-white text-sm flex items-center gap-2 transition-all z-20"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Menu
    </button>
  )
}

function Skeleton({ onPositionChange, onRotationChange, townScene, currentTierLevel, onZoneBlocked }) {
  const { scene } = useGLTF('/models/Characters_Skeleton.gltf')
  const skeletonRef = useRef()
  const headBone = useRef()
  const keys = useKeyboardControls()
  // Spawn on the road - adjusted position
  const position = useRef(new THREE.Vector3(8, -3, 0))
  const rotation = useRef(Math.PI) // Face down the road
  const walkPhase = useRef(0)
  const isMoving = useRef(false)
  const raycaster = useRef(new THREE.Raycaster())
  const lastBlockedZone = useRef(null)

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.name === 'Head') {
          headBone.current = child
        }
      })
    }
  }, [scene])

  // Collision detection function
  const checkCollision = (newPos, townScene) => {
    if (!townScene) return false

    // Cast rays in multiple directions to detect walls
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ]

    const origin = new THREE.Vector3(newPos.x, newPos.y + 1, newPos.z)
    const collisionDistance = 0.5

    for (const dir of directions) {
      raycaster.current.set(origin, dir)
      raycaster.current.far = collisionDistance

      const intersects = raycaster.current.intersectObject(townScene, true)
      if (intersects.length > 0) {
        // Check if collision is in movement direction
        const moveDir = new THREE.Vector3(
          newPos.x - position.current.x,
          0,
          newPos.z - position.current.z
        ).normalize()

        if (moveDir.dot(dir) > 0.5) {
          return true // Collision detected
        }
      }
    }
    return false
  }

  useFrame((state, delta) => {
    if (!skeletonRef.current) return

    const moveSpeed = 4 * delta
    const turnSpeed = 2.5 * delta
    let moving = false

    // Turn left/right (A/D or Left/Right arrows)
    if (keys.current.left) {
      rotation.current += turnSpeed
      moving = true
    }
    if (keys.current.right) {
      rotation.current -= turnSpeed
      moving = true
    }

    // Calculate potential new position
    const newPos = position.current.clone()

    // Move forward/backward relative to facing direction (W/S or Up/Down arrows)
    if (keys.current.forward) {
      newPos.x += Math.sin(rotation.current) * moveSpeed
      newPos.z += Math.cos(rotation.current) * moveSpeed
      moving = true
    }
    if (keys.current.backward) {
      newPos.x -= Math.sin(rotation.current) * moveSpeed * 0.6
      newPos.z -= Math.cos(rotation.current) * moveSpeed * 0.6
      moving = true
    }

    // Check zone access before moving
    const targetZone = getZoneAtPosition({ x: newPos.x, z: newPos.z })
    const isZoneBlocked = targetZone && !canAccessZone(targetZone, currentTierLevel)

    if (isZoneBlocked) {
      // Blocked by locked zone
      if (lastBlockedZone.current !== targetZone.id) {
        lastBlockedZone.current = targetZone.id
        onZoneBlocked?.(targetZone.id)
      }
    } else {
      // Clear blocked zone when not blocked
      if (lastBlockedZone.current) {
        lastBlockedZone.current = null
        onZoneBlocked?.(null)
      }

      // Only move if no collision and zone is accessible
      if (!checkCollision(newPos, townScene)) {
        position.current.x = THREE.MathUtils.clamp(newPos.x, -100, 100)
        position.current.z = THREE.MathUtils.clamp(newPos.z, -100, 100)
      }
    }

    isMoving.current = moving

    if (isMoving.current) {
      // Walking bobbing animation
      walkPhase.current += delta * 12
      position.current.y = -3 + Math.abs(Math.sin(walkPhase.current)) * 0.08
    } else {
      // Idle bobbing
      position.current.y = -3 + Math.sin(state.clock.elapsedTime * 0.8) * 0.03
      walkPhase.current = 0
    }

    // Apply position and rotation
    skeletonRef.current.position.copy(position.current)
    skeletonRef.current.rotation.y = rotation.current

    // Notify parent for camera following
    onPositionChange?.(position.current.clone())
    onRotationChange?.(rotation.current)

    // Head idle animation
    if (headBone.current) {
      headBone.current.rotation.x = THREE.MathUtils.lerp(
        headBone.current.rotation.x,
        -0.24 + Math.sin(state.clock.elapsedTime) * 0.02,
        0.1
      )
      headBone.current.rotation.z = THREE.MathUtils.lerp(headBone.current.rotation.z, 0, 0.1)
    }
  })

  return <primitive ref={skeletonRef} object={scene} scale={1.2} position={[8, -3, 0]} rotation={[0, Math.PI, 0]} />
}

function WesternTown({ onSceneReady }) {
  const { scene } = useGLTF('/models/western-town/western_city.glb')

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.receiveShadow = true
          child.castShadow = true
        }
      })
      // Pass scene reference for collision detection
      onSceneReady?.(scene)
    }
  }, [scene, onSceneReady])

  // Scale and position western town for skeleton
  return <primitive object={scene} scale={1} position={[0, -3, 0]} />
}

// Third-person camera that follows behind the skeleton
function ThirdPersonCamera({ targetPosition, targetRotation }) {
  const { camera } = useThree()
  const smoothedPosition = useRef(new THREE.Vector3(0, 0, 5))
  const smoothedLookAt = useRef(new THREE.Vector3(0, -2, 0))

  useFrame(() => {
    if (targetPosition) {
      // Camera offset: behind and above the skeleton (over-the-shoulder)
      const cameraDistance = 3
      const cameraHeight = 1.2
      // Subtract offset to position camera BEHIND the skeleton
      const offsetX = -Math.sin(targetRotation) * cameraDistance
      const offsetZ = -Math.cos(targetRotation) * cameraDistance

      // Target camera position (behind and slightly above skeleton)
      const targetCamPos = new THREE.Vector3(
        targetPosition.x + offsetX,
        targetPosition.y + cameraHeight + 2.5,
        targetPosition.z + offsetZ
      )

      // Smoothly follow
      smoothedPosition.current.lerp(targetCamPos, 0.08)
      camera.position.copy(smoothedPosition.current)

      // Look at skeleton's upper back/head area
      const lookAtPoint = new THREE.Vector3(
        targetPosition.x,
        targetPosition.y + 1.8,
        targetPosition.z
      )
      smoothedLookAt.current.lerp(lookAtPoint, 0.1)
      camera.lookAt(smoothedLookAt.current)
    }
  })

  return null
}

function Scene({ onSkeletonMove, onSkeletonRotate, skeletonPosition, skeletonRotation, currentTierLevel, collectedIds, onCollect, onZoneBlocked }) {
  const [townScene, setTownScene] = useState(null)

  return (
    <>
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#c9a66b', 30, 100]} />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={2}
        color="#fff5e0"
        castShadow
      />
      <pointLight position={[-5, 5, 5]} intensity={8} color="#ffcc77" distance={25} />
      <pointLight position={[5, 3, -5]} intensity={6} color="#ffd699" distance={20} />
      <pointLight position={[0, 2, 5]} intensity={4} color="#ffffff" distance={15} />

      <ThirdPersonCamera targetPosition={skeletonPosition} targetRotation={skeletonRotation} />

      {/* Zone barriers for locked areas */}
      <LockedZoneBarriers currentTierLevel={currentTierLevel} />

      {/* Collectible orbs */}
      <CollectiblesGroup
        collectibles={COLLECTIBLES}
        currentTier={{ level: currentTierLevel }}
        collectedIds={collectedIds}
        onCollect={onCollect}
        playerPosition={skeletonPosition}
      />

      <Suspense fallback={null}>
        <WesternTown onSceneReady={setTownScene} />
        <Skeleton
          onPositionChange={onSkeletonMove}
          onRotationChange={onSkeletonRotate}
          townScene={townScene}
          currentTierLevel={currentTierLevel}
          onZoneBlocked={onZoneBlocked}
        />
      </Suspense>
    </>
  )
}

function Header() {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-4xl font-bold text-white tracking-wider" style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}>
          SKELE
        </h1>
        <MarketCapBadge />
      </div>

      <div className="flex gap-2 items-center">
        <a
          href="https://x.com/skele_coin"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2 rounded-full border border-white/10 text-white text-sm flex items-center gap-2 transition-all"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Twitter
        </a>
        <button
          onClick={() => navigator.clipboard.writeText('Coming Soon')}
          className="bg-white/10 hover:bg-white/20 backdrop-blur px-4 py-2 rounded-full border border-white/10 text-white text-sm transition-all"
        >
          CA: Coming Soon
        </button>
        <WalletButton />
      </div>
    </div>
  )
}

function ControlsHint() {
  return (
    <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/10">
      <div className="flex gap-1 items-center text-white/70 text-xs">
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">WASD</kbd>
        <span className="text-white/40">or</span>
        <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">Arrows</kbd>
        <span className="ml-1">to move</span>
      </div>
    </div>
  )
}

// Inner game component that uses game context
function GameContent() {
  const {
    currentTier,
    collectedIds,
    collectItem,
    setUnlockPrompt
  } = useGame()

  // Game state: 'start' | 'loading' | 'playing' | 'docs'
  const [gameState, setGameState] = useState('start')
  const [loadProgress, setLoadProgress] = useState(0)
  const [showDocs, setShowDocs] = useState(false)
  const [skeletonPosition, setSkeletonPosition] = useState(new THREE.Vector3(0, -3, 0))
  const [skeletonRotation, setSkeletonRotation] = useState(0)

  const handleStart = useCallback(() => {
    setGameState('loading')
    setLoadProgress(0)
    // Simulate loading progress
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setTimeout(() => setGameState('playing'), 300)
      }
      setLoadProgress(progress)
    }, 200)
  }, [])

  const handlePause = useCallback(() => {
    setGameState('start')
  }, [])

  const handleDocs = useCallback(() => {
    setShowDocs(true)
  }, [])

  const handleBackFromDocs = useCallback(() => {
    setShowDocs(false)
  }, [])

  const handleSkeletonMove = useCallback((position) => {
    setSkeletonPosition(position)
  }, [])

  const handleSkeletonRotate = useCallback((rotation) => {
    setSkeletonRotation(rotation)
  }, [])

  const handleZoneBlocked = useCallback((zoneId) => {
    setUnlockPrompt(zoneId)
  }, [setUnlockPrompt])

  const handleCollect = useCallback((id) => {
    collectItem(id)
  }, [collectItem])

  // Docs page
  if (showDocs) {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <DocsPage onBack={handleBackFromDocs} />
      </div>
    )
  }

  // Start screen
  if (gameState === 'start' || gameState === 'loading') {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <FlameBackground />
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
          <StartScreenScene />
        </Canvas>
        <StartScreenUI
          onStart={handleStart}
          onDocs={handleDocs}
          isLoading={gameState === 'loading'}
          loadProgress={loadProgress}
        />
      </div>
    )
  }

  // Main game
  return (
    <div className="w-full h-full relative overflow-hidden">
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }} shadows>
        <Scene
          onSkeletonMove={handleSkeletonMove}
          onSkeletonRotate={handleSkeletonRotate}
          skeletonPosition={skeletonPosition}
          skeletonRotation={skeletonRotation}
          currentTierLevel={currentTier.level}
          collectedIds={collectedIds}
          onCollect={handleCollect}
          onZoneBlocked={handleZoneBlocked}
        />
      </Canvas>

      <PauseButton onPause={handlePause} />
      <Header />
      <ControlsHint />

      {/* Game HUD */}
      <div className="absolute bottom-4 right-4 z-10">
        <MarketCapDisplay />
      </div>

      {/* Overlay notifications */}
      <TierUpNotification />
      <UnlockPrompt />
      <DevPanel />
    </div>
  )
}

// Main App wrapped with providers
function App() {
  return (
    <WalletContextProvider>
      <GameProvider>
        <GameContent />
      </GameProvider>
    </WalletContextProvider>
  )
}

export default App

useGLTF.preload('/models/Characters_Skeleton.gltf')
useGLTF.preload('/models/western-town/western_city.glb')
