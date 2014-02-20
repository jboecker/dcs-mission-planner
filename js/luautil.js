function ipc_unescape(str) {
	str = str.replace(/>t/g, "\t");
	str = str.replace(/>n/g, "\n");
	str = str.replace(/>r/g, "\r");
	str = str.replace(/>a/g, "'");
	str = str.replace(/>q/g, '"');
	str = str.replace(/>b/g, "\\");
	str = str.replace(/>g/g, ">");
	return str;
}

function ipc_escape(str) {
	str = str.replace(/>/g, ">g");
	str = str.replace(/\\t/g, ">t");
	str = str.replace(/\\n/g, ">n");
	str = str.replace(/\\r/g, ">r");
	str = str.replace(/'/g, ">a");
	str = str.replace(/"/g, ">q");
	str = str.replace(/\\\\/g, ">b");
	return str;
}

Lua.execute('\n\
function ipc_escape(mstr)\n\
	mstr = string.gsub(mstr, string.char(62), ">g")\n\
	mstr = string.gsub(mstr, string.char(9), ">t")\n\
	mstr = string.gsub(mstr, string.char(10), ">n")\n\
	mstr = string.gsub(mstr, string.char(13), ">r")\n\
	mstr = string.gsub(mstr, string.char(39), ">a")\n\
	mstr = string.gsub(mstr, string.char(34), ">q")\n\
	mstr = string.gsub(mstr, string.char(92), ">b")\n\
	return mstr\n\
end\n\
');

Lua.execute('\n\
function ipc_unescape(mstr)\n\
	mstr = string.gsub(mstr, ">t", string.char(9))\n\
	mstr = string.gsub(mstr, ">n", string.char(10))\n\
	mstr = string.gsub(mstr, ">r", string.char(13))\n\
	mstr = string.gsub(mstr, ">a", string.char(39))\n\
	mstr = string.gsub(mstr, ">q", string.char(34))\n\
	mstr = string.gsub(mstr, ">b", string.char(92))\n\
	mstr = string.gsub(mstr, ">g", string.char(62))\n\
	return mstr\n\
end\n\
');


Lua.execute('\n\
function table.show(t, name, indent)\n\
   local cart     -- a container\n\
   local autoref  -- for self references\n\
\n\
   -- (RiciLake) returns true if the table is empty\n\
   local function isemptytable(t) return next(t) == nil end\n\
\n\
   local function basicSerialize (o)\n\
      local so = tostring(o)\n\
      if type(o) == "function" then\n\
         local info = debug.getinfo(o, "S")\n\
         -- info.name is nil because o is not a calling level\n\
         if info.what == "C" then\n\
            return string.format("%q", so .. ", C function")\n\
         else \n\
            -- the information is defined through lines\n\
            return string.format("%q", so .. ", defined in (" ..\n\
                info.linedefined .. "-" .. info.lastlinedefined ..\n\
                ")" .. info.source)\n\
         end\n\
      elseif type(o) == "number" or type(o) == "boolean" then\n\
         return so\n\
      else\n\
         return string.format("%q", so)\n\
      end\n\
   end\n\
\n\
   local function addtocart (value, name, indent, saved, field)\n\
      indent = indent or ""\n\
      saved = saved or {}\n\
      field = field or name\n\
\n\
      cart = cart .. indent .. field\n\
\n\
      if type(value) ~= "table" then\n\
         cart = cart .. " = " .. basicSerialize(value) .. ";\\n"\n\
      else\n\
         if saved[value] then\n\
            cart = cart .. " = {}; -- " .. saved[value] \n\
                        .. " (self reference)\\n"\n\
            autoref = autoref ..  name .. " = " .. saved[value] .. ";\\n"\n\
         else\n\
            saved[value] = name\n\
            --if tablecount(value) == 0 then\n\
            if isemptytable(value) then\n\
               cart = cart .. " = {};\\n"\n\
            else\n\
               cart = cart .. " = {\\n"\n\
               for k, v in pairs(value) do\n\
                  k = basicSerialize(k)\n\
                  local fname = string.format("%s[%s]", name, k)\n\
                  field = string.format("[%s]", k)\n\
                  -- three spaces between levels\n\
                  addtocart(v, fname, indent .. "   ", saved, field)\n\
               end\n\
               cart = cart .. indent .. "};\\n"\n\
            end\n\
         end\n\
      end\n\
   end\n\
\n\
   name = name or "__unnamed__"\n\
   if type(t) ~= "table" then\n\
      return name .. " = " .. basicSerialize(t)\n\
   end\n\
   cart, autoref = "", ""\n\
   addtocart(t, name, indent)\n\
   return cart .. autoref\n\
end\n\
');