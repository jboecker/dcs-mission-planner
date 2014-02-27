--Initialization script for the Mission lua Environment (SSE)

dofile('Scripts/ScriptingSystem.lua')

--Sanitize Mission Scripting environment
--This makes unavailable some unsecure functions. 
--Mission downloaded from server to client may contain potentialy harmful lua code that may use these functions.
--You can remove the code below and make availble these functions at your own risk.

local function sanitizeModule(name)
	_G[name] = nil
	package.loaded[name] = nil
end

do
	local tools = {}
	tools.JSON = loadfile([[Scripts\JSON.lua]])()
	tools.lfs = lfs
	tools.io = io
	function saveMissionState(info)
		local file, err = tools.io.open(tools.lfs.writedir()..[[Logs\MissionState.txt]], "w")
		if file then
			file:write(tools.JSON:encode(info))
			file:close()
			return true
		end
		return false
	end
end

do
	sanitizeModule('os')
	sanitizeModule('io')
	sanitizeModule('lfs')
	require = nil
	loadlib = nil
end