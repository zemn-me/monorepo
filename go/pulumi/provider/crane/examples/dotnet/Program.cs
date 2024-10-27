using System.Collections.Generic;
using System.Linq;
using Pulumi;
using crane = Pulumi.crane;

return await Deployment.RunAsync(() => 
{
    var myRandomResource = new crane.Random("myRandomResource", new()
    {
        Length = 24,
    });

    return new Dictionary<string, object?>
    {
        ["output"] = 
        {
            { "value", myRandomResource.Result },
        },
    };
});

